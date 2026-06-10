# danoh.com

Personal website of Daniel Oh: a Windows 98 desktop where you describe an app
and the AI builds it in your browser. Live at [danoh.com](https://danoh.com).

Built on [windows9x](https://github.com/SawyerHood/windows9x) by Sawyer Hood.

## Getting started

Create a `.env` file with the following in the root directory:

```
ANTHROPIC_API_KEY=<your-anthropic-api-key>
NEXT_PUBLIC_LOCAL_MODE=true
```

1. Install [Node.js](https://nodejs.org/en) v22 or greater
2. Run `npm install`
3. Run `npm run dev`
4. Navigate to `http://localhost:3000`

## Deployment

This project uses Docker with a multi-stage build. Push to `main` to trigger the CI/CD pipeline which builds and pushes to Docker Hub. Watchtower auto-deploys on the server.

## License

AGPL-3.0 - See [LICENSE](LICENSE) for details.
