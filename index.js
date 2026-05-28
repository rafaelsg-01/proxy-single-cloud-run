require('dotenv').config();

const http = require('node:http');
const https = require('node:https');
const { pipeline } = require('node:stream');
const { promisify } = require('node:util');
const { URL } = require('node:url');
const HttpProxyAgent = require('http-proxy-agent').HttpProxyAgent;
const HttpsProxyAgent = require('https-proxy-agent').HttpsProxyAgent;

const Const_pipe = promisify(pipeline);

const PROXY_USER = process.env.PROXY_USER;
const PROXY_PASS = process.env.PROXY_PASS;
const PROXY_HOST = process.env.PROXY_HOST;
const PROXY_PORT = process.env.PROXY_PORT;
const API_TOKEN = process.env.API_TOKEN;

const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;
const httpProxyAgent = new HttpProxyAgent(proxyUrl);
const httpsProxyAgent = new HttpsProxyAgent(proxyUrl);

const PORT = process.env.PORT || 8080;

const server = http.createServer(async (Parameter_request, Parameter_response) => {
  try {
    // Autenticação \/
    const Const_url = new URL(Parameter_request.url, `http://${Parameter_request.headers.host}`);
    const Const_tokenQueryRequest = Const_url.searchParams.get('token');
    const Const_urlQueryRequest = Const_url.searchParams.get('url');
    const Const_simpleQueryRequest = Const_url.searchParams.get('simple');
    const Const_methodRequest = Parameter_request.method;
    const Const_bodyRequest = await getRequestBody(Parameter_request);

    if (Const_tokenQueryRequest !== API_TOKEN) {
      Parameter_response.writeHead(461, { 'Content-Type': 'text/plain' });
      Parameter_response.end('Invalid token');
      return;
    }

    if (!Const_urlQueryRequest) {
      Parameter_response.writeHead(462, { 'Content-Type': 'text/plain' });
      Parameter_response.end('Missing url parameter');
      return;
    }

    if (Const_methodRequest?.toUpperCase() !== 'GET' && Const_methodRequest?.toUpperCase() !== 'POST') {
      Parameter_response.writeHead(463, { 'Content-Type': 'text/plain' });
      Parameter_response.end('Method Not Allowed');
      return;
    }
    // Autenticação /\

    // Realiza request \/
    const Const_moduleHttpsOrHttp = Const_urlQueryRequest.startsWith('https') ? https : http;
    const Const_agent = Const_urlQueryRequest.startsWith('https') ? httpsProxyAgent : httpProxyAgent;

    const Let_requestInitFetch = {
      method: Const_methodRequest,
      agent: Const_agent,
      headers: {}
    };

    const Const_allowedHeaders = [
      'Accept-Language',
      'Authorization',
      'Content-Type',
      'Sec-CH-UA',
      'Sec-CH-UA-Mobile',
      'Sec-CH-UA-Platform',
      'Sec-Fetch-Dest',
      'Sec-Fetch-Mode',
      'Sec-Fetch-Site',
      'Sec-Fetch-User',
      'Referer',
      'H31ffadrg3bb7',
      'X-Requested-With',
    ];

    for (let Let_single of Const_allowedHeaders) {
      if (Parameter_request.headers?.[Let_single] || Parameter_request.headers?.[Let_single.toLowerCase()]) {
        Let_requestInitFetch.headers[Let_single] = Parameter_request.headers?.[Let_single] || Parameter_request.headers?.[Let_single.toLowerCase()];
      }
    }

    // Se simple=json ou simple=text, faz fetch simples
    if (Const_simpleQueryRequest === 'json' || Const_simpleQueryRequest === 'text') {
      const Const_responseFetch = await fetch(Const_urlQueryRequest, {
        ...Let_requestInitFetch,
        body: Const_methodRequest === 'POST' ? Const_bodyRequest : undefined
      });

      let Let_data;
      if (Const_simpleQueryRequest === 'json') {
        Let_data = await Const_responseFetch.json();
      } else {
        Let_data = await Const_responseFetch.text();
      }

      Parameter_response.writeHead(Const_responseFetch.status, {
        'Content-Type': Const_simpleQueryRequest === 'json' ? 'application/json' : 'text/plain'
      });
      Parameter_response.end(Const_simpleQueryRequest === 'json' ? JSON.stringify(Let_data) : Let_data);
    } else {
      await new Promise((Parameter_resolve, Parameter_reject) => {
        const Const_responseFetch = Const_moduleHttpsOrHttp.request(Const_urlQueryRequest, Let_requestInitFetch, (Parameter_responseFetch) => {
          Parameter_response.writeHead(Parameter_responseFetch.statusCode, {
            'Content-Type': Parameter_responseFetch.headers['content-type'] || 'text/plain'
          });

          Const_pipe(Parameter_responseFetch, Parameter_response).then(Parameter_resolve).catch(Parameter_reject);
        });

        Const_responseFetch.on('error', (Parameter_error) => Parameter_reject(Parameter_error));

        if (Const_methodRequest === 'POST' && Const_bodyRequest) {
          Const_responseFetch.write(Const_bodyRequest);
        }

        Const_responseFetch.end();
      });
    }
    // Realiza request /\
  } catch (Parameter_error) {
    console.error('Error processing request:', Parameter_error);
    Parameter_response.writeHead(460, { 'Content-Type': 'text/plain' });
    Parameter_response.end('Internal Server Error');
  }
});

function getRequestBody(Parameter_request) {
  return new Promise((resolve, reject) => {
    let Let_body = '';
    Parameter_request.on('data', (chunk) => {
      Let_body += chunk.toString();
    });
    Parameter_request.on('end', () => {
      resolve(Let_body);
    });
    Parameter_request.on('error', reject);
  });
}

server.listen(PORT, () => {
  console.log(`Cloud Run proxy server listening on port ${PORT}`);
});
