require('@google-cloud/debug-agent').start({serviceContext: {enableCanary: true}});

const {Storage} = require('@google-cloud/storage');

const bucketName = 'wiscocovidtest'

async function listLogFiles() {
  // Lists files in the bucket
  const storage = new Storage();
  console.log(`storage: ${storage}`)
  console.log(`bucket name: ${bucketName}`)
  const bucket = storage.bucket(bucketName)
  console.log(`bucket: ${bucket.constructor.name}`)
  const existingBucket = await bucket.exists()
  const files = await bucket.getFiles()

  return files
}

exports.loadLogs = (request, response) => {
  listLogFiles().then(files => {
    console.log(`Files: ${files}`);
    console.log(files[0].name)
    // return files
  })
};
