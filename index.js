require('@google-cloud/debug-agent').start({serviceContext: {enableCanary: true}});

const {Storage} = require('@google-cloud/storage');

const bucketName = 'wiscocovidtest'

function listLogFiles() {
  // Lists files in the bucket
  const storage = new Storage();
  console.log(`storage: ${storage}`)
  console.log(`bucket name: ${bucketName}`)
  const bucket = storage.bucket(bucketName)
  console.log(`bucket: ${bucket.constructor.name}`)
  return bucket.exists().then(function(data) {
    return bucket.getFiles(function(err, files) {
      if (!err) {
        return files
      } else {
        console.log(`errors: ${errors}`)
      }
    })
  });
}

exports.loadLogs = (request, response) => {

  const files = listLogFiles()

  console.log('Files:');
  files.forEach(file => {
    console.log(file.name)
  });
  return files
  // files is an array of File objects.

};
