require('@google-cloud/debug-agent').start({serviceContext: {enableCanary: true}});

const {Storage} = require('@google-cloud/storage');

const bucketName = 'wiscocovidtest'

function listLogFiles() {
  // Lists files in the bucket
  const storage = new Storage();
  console.log(`storage: ${storage}`)
  const [files] = storage.bucket(bucketName).getFiles();

  console.log('Files:');
  files.forEach(file => {
    console.log(file.name);
  });
}

exports.loadLogs = (request, response) => {
  listLogFiles().catch(console.error);
};

