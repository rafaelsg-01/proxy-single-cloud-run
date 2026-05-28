require('dotenv').config(); // Carrega as variáveis se você for testar localmente
const express = require('express');
const axios = require('axios');
const { HttpsProxyAgent } = require('https-proxy-agent');

const app = express();
app.use(express.raw({ type: '*/*', limit: '10mb' }));

// 1. Puxando as credenciais das variáveis de ambiente ocultas
const PROXY_USER = process.env.PROXY_USER;
const PROXY_PASS = process.env.PROXY_PASS;
const PROXY_HOST = process.env.PROXY_HOST;
const PROXY_PORT = process.env.PROXY_PORT;
const API_TOKEN = process.env.API_TOKEN;

// 2. Montando a URL do Proxy dinamicamente
const proxyUrl = `http://${PROXY_USER}:${PROXY_PASS}@${PROXY_HOST}:${PROXY_PORT}`;
const httpsAgent = new HttpsProxyAgent(proxyUrl);

app.all('/*', async (req, res) => {
    const targetUrl = req.query.url;
    const token = req.query.token;

    // 3. Valida se o token enviado pelo Cloudflare bate com a variável de ambiente
    if (token !== API_TOKEN) {
        return res.status(401).send("Acesso Negado");
    }

    if (!targetUrl) {
        return res.status(400).send("Faltou o parametro ?url=");
    }

    const headers = { ...req.headers };
    delete headers.host; 
    delete headers['content-length']; 

    try {
        const axiosConfig = {
            method: req.method,
            url: targetUrl,
            headers: headers,
            httpsAgent: httpsAgent,
            validateStatus: () => true
        };

        if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && req.body.length > 0) {
            axiosConfig.data = req.body;
        }

        // console.log(`[Proxy DataImpulse] Fazendo requisição para: ${targetUrl}`);
        const response = await axios(axiosConfig);

        for (const [key, value] of Object.entries(response.headers)) {
            res.setHeader(key, value);
        }
        
        res.status(response.status).send(response.data);

    } catch (error) {
        // console.error("Erro no Proxy:", error.message);
        res.status(500).send({ error: "Erro interno no Proxy Cloud Run", details: error.message });
    }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
    console.log(`Cloud Run Proxy rodando na porta ${port}`);
});