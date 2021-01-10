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
  bucket.exists().then(function(data) {
    console.log("YAY! NOt insane")
  });

  const files = bucket.getFiles(function(err, files) {
    if (!err) {
      console.log(files)

      console.log('Files:');
      files.forEach(file => {
        console.log(file.name)
      });
      // files is an array of File objects.
    } else {
      console.log(`errors: ${errors}`)
    }
  })
}

exports.loadLogs = (request, response) => {
  listLogFiles().catch(console.error)
};
