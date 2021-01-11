const {BigQuery} = require('@google-cloud/bigquery');
const {Storage} = require('@google-cloud/storage');

const bucketName = process.env.BUCKET_NAME
const datasetName = process.env.DATASET_NAME
const tableName = process.env.TABLE_NAME

// Instantiate clients
const bigquery = new BigQuery();
const storage = new Storage();

// Make the call back hell of JS a bit easier to handle, since Google's API's don't
// work with both "await" and "try/catch"
// Borrowed from https://stackoverflow.com/a/58823329/604031
Promise.prototype.catchToObj = function catchToObj() {
    return this.catch(error => ({ error }));
};

async function listLogFiles() {
  // Lists files in the bucket
  const bucket = storage.bucket(bucketName)
  const [files] = await bucket.getFiles()

  return files
}

async function archiveFiles(fileNames) {
  // Archive all files in the files array into the `archive/` folder
  fileNames.forEach(async (fileName) => {
    await storage
      .bucket(bucketName)
      .file(fileName)
      .copy(storage.bucket(bucketName).file(`archive/${fileName}`));

    await storage.bucket(bucketName).file(fileName).delete();
  })
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

exports.loadLogs = async (request, response) => {
  // Make sure the dataset is set up
  const dataset = createBQDataset().catchToObj()
  if (dataset && dataset.error) {
    console.error(dataset.error);
  }

  // Get all the files
  const files = await listLogFiles()

  let fileNames = files.map((file) => {
    return file.name
  })

  // We filter out anything that's in the `archive` folder
  fileNames = fileNames.filter(word => word.startsWith('archive/') === false)

  console.log(`Importing files: ${fileNames}`)

  fileNames.forEach(async (fileName) => {
    await loadJSONFromGCSAutodetect(fileName)
  })

  await archiveFiles(fileNames)
}
