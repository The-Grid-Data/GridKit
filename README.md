This is an NPM package that can be installed anywhere. It's purpose is to:

- hooks: query The Grid graphql endpoint, with custom graphql quries
- components: easily render the displayed data. First component will be a thumbnail hover to display profile information

Tools:

- use bun
- fetching: axios
- displaying fetched data: tanstack/usequery
- graphql handling: graffle
- testing components: storybook

Deliverables:

- npm package that can be uploaded to registry and easily imported to any project
- hook that lets user paste a custom graphql query (same they would use on hasura) and return grid data
- thumbnail component to display profile information on hover.
- storybook to test the display of the visual component
- playground/testing environment: I need an easy way to manually test these components end to end, in a simple environment that runs on pnpm run dev
- should be as small as possible

Questions:

- I need the graffle hook to easily handle custom queries, so devs can copy/paste from hasura
- The main users will be using react, but what would it take to make it agnostic
- What options are available for typesafety. Pre-build: needs to be able to query schema updates and generate/have types available
