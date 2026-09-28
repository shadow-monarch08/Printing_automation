const fs = require('fs');
const path = require('path');
const https = require('https');

const fontsDir = path.join(__dirname, 'src', 'fonts');
if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}

const fonts = {
  'IBMPlexSans-Regular.woff2': 'https://fonts.gstatic.com/s/ibmplexsans/v19/zYXgKVElMYYaJe8bpLHnCwDKhdHeEw.woff2',
  'IBMPlexSans-SemiBold.woff2': 'https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjQ76AIFscA.woff2',
  'IBMPlexSans-Bold.woff2': 'https://fonts.gstatic.com/s/ibmplexsans/v19/zYX9KVElMYYaJe8bpLHnCwDKjWr7AIFscA.woff2',
  'CourierPrime-Regular.woff2': 'https://fonts.gstatic.com/s/courierprime/v9/u-450q2lgwslOqpF_6gQ8kELaw_g.woff2',
  'JetBrainsMono-Regular.woff2': 'https://fonts.gstatic.com/s/jetbrainsmono/v18/tDbY2o-flEEny0FZhsfKu5WU4zr3E_BX0PnT8RD8yKw.woff2'
};

Promise.all(Object.entries(fonts).map(([filename, url]) => {
  return new Promise((resolve, reject) => {
    const dest = path.join(fontsDir, filename);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Downloaded', filename);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
})).then(() => console.log('All fonts downloaded')).catch(err => console.error(err));
