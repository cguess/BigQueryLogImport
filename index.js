const {BigQuery} = require('@google-cloud/bigquery');
const {Storage} = require('@google-cloud/storage');
const lineReader = require('line-reader');

// The Google Storage bucket name that we're importing from
const bucketName = process.env.BUCKET_NAME
// The BigQuery dataset name, this will be created if it doesn't exist
const datasetName = process.env.DATASET_NAME
// The table in the dataset, this will be created if it doesn't exist
const tableName = process.env.TABLE_NAME
// The number of files to import per loop. Mostly, keep it as is, but if you're importing 1000's of logs, you can manipulate this to not run out of memory
const concurrentImport = process.env.CONCURRENT_IMPORT === "undefined" ? 100 : process.env.CONCURRENT_IMPORT
// The total to import on any given run. Not an issue when running the function in the cloud, but for local it is
const totalToImport = process.env.TOTAL_TO_IMPORT === "undefined" ? 1000 : process.env.TOTAL_TO_IMPORT

// Instantiate clients
const bigquery = new BigQuery();
const storage = new Storage();
const bucket = storage.bucket(bucketName)

// We get limited sometimes on calls going too quickly, so here's a dirty `sleep` implementation
const sleep = (delay) => new Promise((resolve) => setTimeout(resolve, delay))

// Make the call back hell of JS a bit easier to handle, since Google's API's don't
// work with both "await" and "try/catch"
// Borrowed from https://stackoverflow.com/a/58823329/604031
Promise.prototype.catchToObj = function catchToObj() {
    return this.catch(error => ({ error }));
};

// The default for next_query sets up the functions for manual pagination later on
async function listLogFiles(next_query = {autoPaginate: false, maxResults: concurrentImport}) {
  // Lists files in the bucket
  return await bucket.getFiles(next_query);
}

async function archiveFiles(filename) {
  // Archive all files in the files array into the `z_archive/` folder.
  // We use z_archive because our files start with 'enx' which means if it's 'archive'
  // we'll loop through all of the archived files before we get to the new ones.
  await storage
    .bucket(bucketName)
    .file(filename)
    .copy(storage.bucket(bucketName).file(`z_archive/${filename}`));

  await storage.bucket(bucketName).file(filename).delete();
}

async function createBQDataset() {
  // Creates a client
  const bigqueryClient = new BigQuery();

  // Create a dataset, errors out if it exists already, catch it.
  const [dataset] = await bigqueryClient.createDataset(datasetName);
  console.log(`Dataset ${dataset.id} created.`);

  return dataset
}

async function loadJSONFromGCSAutodetect(filename) {
  // Imports a GCS file into a table with autodetected schema.
  // Configure the load job. For full list of options, see:
  // https://cloud.google.com/bigquery/docs/reference/rest/v2/Job#JobConfigurationLoad
  const metadata = {
    sourceFormat: 'CSV',
    autodetect: true,
    location: 'US',
  };

  // Load data from a Google Cloud Storage file into the table
  const [job] = await bigquery
    .dataset(datasetName)
    .table(tableName)
    .load(storage.bucket(bucketName).file(filename), metadata);
  // load() waits for the job to finish
  console.log(`Job ${job.id} completed.`);

  // Check the job's status for errors
  const errors = job.status.errors;
  if (errors && errors.length > 0) {
    throw errors;
  }
}

async function streamJSONFromGCS(fileName) {
  // Imports a GCS file into a table with autodetected schema.
  // Configure the load job. For full list of options, see:
  // https://cloud.google.com/bigquery/docs/reference/rest/v2/Job#JobConfigurationLoad
  const metadata = {
    sourceFormat: 'CSV',
    autodetect: true,
    location: 'US',
  };

  lineReader.eachLine(storage.bucket(bucketName).file(fileName), async (line, last) => {
    // Load data from a Google Cloud Storage file into the table
    await bigquery
      .dataset(datasetName)
      .table(tableName)
      .insert(line)
  });

  console.log(`Loaded ${fileName}`);
}

exports.loadLogs = async (request, response) => {
  // Make sure the dataset is set up
  const dataset = createBQDataset().catchToObj()
  if (dataset && dataset.error) {
    console.error(dataset.error);
  }

  let count = 0
  let totalCount = 0

  let next_query = null
  // Loop forever until we say otherwise, for pagination of results for memory purposes
  // on LARGE folders
  while(true) {
    // Get the files for this autopaginate page (can't expand it because we need
    // `next_query` kept for the next iteration of the loop)
    console.log(`Loop: ${count}`)
    count = count + 1

    let listing_result = next_query === null ? await listLogFiles() : await listLogFiles(next_query)
    let files = listing_result[0]
    next_query = listing_result[1]

    // Get just the names out of the files
    let fileNames = files.map((file) => {
      return file.name
    })

    console.log(`Importing ${fileNames.length} files`)

    // We filter out anything that's in the `z_archive` folder
    //
    // We use z_archive because our files start with 'enx' which means if it's 'archive'
    // we'll loop through all of the archived files before we get to the new ones.
    fileNames = fileNames.filter((fileName) => {
      return fileName.startsWith('z_archive/') === false
    })

    // Load each file and then move it to the `z_archive/` folder in the bucket
    // For the reason for the name, look at the function
    fileNames.forEach(async (fileName) => {
      console.log (`Loading file: ${fileName}`)
      totalCount += 1
      // We want to load the first to make sure headers are there
      // Otherwise it'll make it faster most of the time as well
      // if (count === 1) {
      //   loadJSONFromGCSAutodetect(fileName).then(() => {
      //     archiveFiles(fileName)
      //   })
      // } else {
      //   // If we have some backed up files we stream the rest.
      //   streamJSONFromGCS(fileName).then(() => {
      //     archiveFiles(fileName)
      //   })
      // }

      // Streaming might not work well, or be too specific and/or complicated.
      // Instead, we'll just have to rely on the fact that these will error out, and then
      // go again the next hour.
      loadJSONFromGCSAutodetect(fileName).then(() => {
        archiveFiles(fileName)
      })
    })

    console.log(`Total Count: ${totalCount}`)

    // Sleep to let some stuff clean up if we're doing multiple pages, we increase every count
    // because Javascript is weird and stupid and seems to use a global variable for `sleep`
    await sleep(10000 * count)

    // Break out of the loop if there's no more results, or we're onto the archive
    if(next_query === null || fileNames.length === 0 || totalCount >= totalToImport) {
      console.log('Done')
      break
    }
  }
}
