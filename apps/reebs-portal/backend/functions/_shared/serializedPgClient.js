export const serializePgClientQueries = (client) => {
  if (!client || typeof client.query !== "function") return client;

  const query = client.query.bind(client);
  let tail = Promise.resolve();

  client.query = (...args) => {
    const operation = tail.then(() => query(...args));
    tail = operation.catch(() => {});
    return operation;
  };

  return client;
};
