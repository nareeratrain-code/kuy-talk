// entry: initialise storage (Postgres via DATABASE_URL, else JSON file), then start the app
require('./store').init().then(()=>require('./app')).catch(e=>{console.error('startup failed:',e.message);process.exit(1)});
