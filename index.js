require('@google-cloud/debug-agent').start({serviceContext: {enableCanary: true}});

const escapeHtml = require('escape-html');
const bucketName = 'wiscocovidtest'

exports.loadLogs = (request, response) => {
  // This is oddly structured, but I can't figure out how to actually use more than one function.

  listLogFiles = () => {
    // Lists files in the bucket
    const [files] = storage.bucket(bucketName).getFiles();

    console.log('Files:');
    files.forEach(file => {
      console.log(file.name);
    });
  }


  listFiles().catch(console.error);
};

