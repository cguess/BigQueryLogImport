require('@google-cloud/debug-agent').start({serviceContext: {enableCanary: true}});

const {Storage} = require('@google-cloud/storage');

const bucketName = 'wiscocovidtest'

function listLogFiles() {
  // Lists files in the bucket
  const storage = new Storage();
  console.log(`storage: ${storage}`)
  console.log(`bucket name: ${bucketName}`)
  const bucket = storage.bucket(bucketName)
  console.log(`bucket: ${bucket}`)
  const [files] = bucket.getFiles();

  console.log(files)

  console.log('Files:');
  files.forEach(file => {
    console.log(file.name);
  });
}

exports.loadLogs = (request, response) => {
  listLogFiles().catch(console.error);
};

