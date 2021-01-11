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

  return files[0]
}

exports.loadLogs = async (request, response) => {
  const files = await listLogFiles()
  console.log(files.length)
  return files.map((file) => {
    return file.name
  })
};
