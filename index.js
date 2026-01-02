import express from 'express';

const app = express();
const port = process.env.PORT || 8080;

app.use(express.json());

app.all('*', (req, res) => {
  const now = new Date().toISOString();

  console.log('Ritra orchestrator invoked');
  console.log('Method:', req.method);
  console.log('Path:', req.path);
  console.log('Timestamp:', now);

  res.status(200).json({
    status: 'ok',
    service: 'ritra-orchestrator',
    timestamp: now
  });
});

app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
