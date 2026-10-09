# Data Flow Analysis - OnlineEditor with Mitigation

This repository contains both the Analysis Backend Server and the Frontend Online Editor with the ARCoViA framework included.

# Setup 
### Setup Frontend

To set up the project locally, you need to have [Node.js](https://nodejs.org/en/) installed.
Then run the following commands to clone the repository and install the dependencies:

```shell
git clone https://github.com/arcovia-dev/OnlineEditorWithMitigation.git
cd OnlineEditorWithMitigation/frontend/webEditor
npm install
```
Now you might need to change the IP for the REST API to the Ip of your server, or the local address.

For local use edit \frontend\webEditor\vite.config.ts or leave it if the local backend address stays the same.

### Setup Backend With Mitigation

To set up the backend, download our product at https://github.com/DataFlowAnalysis/DataFlowAnalysis/releases.

Clone https://github.com/arcovia-dev/Mitigation and checkout the correct branch.

Import into eclipse.

Now import the OnlineEditor\backend\analysisBackendServer project into eclipse and set the target platform as active.

# Running locally
### Running Frontend 

To run the project locally for testing or development, run the following command:

```shell
npm run dev
```

This will start a local web server. To visit the page, either open the URL shown in the console or press `o` in the console.

### Running Backend 

Simply run main. Established connections are printed on the terminal.

As standard the server with REST API will be deployed at `localhost:3000/api/`

# Building for production
### Building Frontend

Set the IP for the REST API in \frontend\webEditor\src\dfdApiClient\backendUrl.ts

To build the project for production run the following command:

```shell
npm run build
```

This will create a `dist` folder containing the built static assets. The contents of this folder can be uploaded to a web server to host the project.

### Building Backend

Set the target platform for Mitigation as active.
Then export deployable Plug-Ins and Fragments for The SMT, SAT, ILP and ranking packages.

Add the plugin folder to the target platform of the analysisBackendServer, set it as active and export the analysisBackendServer standalone plugin.

To build an executable jar for the backend clone `https://github.com/DataFlowAnalysis/AnalysisBackendServerProduct`, add the plugin folder containing both the mitigation and analysisBackendServer plugins to the target platform, and run `mvn clean verify -Dtycho.localArtifacts=ignore`

The jar can be executed by running 
```shell
eclipse.exe --application org.dataflowanalysis.standalone.application -consoleLog (Windows)
eclipse --application org.dataflowanalysis.standalone.application -consoleLog (Linux/Mac)
```

### Z3 issues
If you are running an older Linux version and the SMT approach throws an exception you might have to manually downgrade the Z3 version in the lib folder of the SMT package.
