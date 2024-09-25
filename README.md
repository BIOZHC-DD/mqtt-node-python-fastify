# new

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run terver.ts
```

This project was created using `bun init` in bun v1.1.29. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.


query for the timestamp
```
SELECT id, topic, message, datetime(timestamp / 1000, 'unixepoch') AS timestamp FROM messages;
```

playing git git
