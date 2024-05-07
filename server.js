const { Client } = require('pg');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const path = require('path');

require('dotenv').config();

let { PGHOST, PGDATABASE, PGUSER, PGPASSWORD } = process.env;

const client = new Client({
  host: PGHOST,
  database: PGDATABASE,
  username: PGUSER,
  password: PGPASSWORD,
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function connectAndCreateTable() {
  try {
    await client.connect();
    await client.query(`
      CREATE TABLE IF NOT EXISTS stocks (
        id SERIAL PRIMARY KEY,
        stock_value INTEGER
      )
    `);
    console.log('Tabela "stocks" verificada ou criada com sucesso.');
  } catch (err) {
    console.error('Erro ao conectar ou criar a tabela "stocks":', err);
  }
}

connectAndCreateTable();

// Função para obter o valor atual das ações
async function getCurrentStockValue() {
  try {
    const result = await client.query('SELECT stock_value FROM stocks LIMIT 1');
    if (result.rows.length > 0) {
      return parseInt(result.rows[0].stock_value);
    } else {
      // Se a tabela estiver vazia, insira um valor padrão
      await client.query('INSERT INTO stocks (stock_value) VALUES ($1)', [100]);
      return 100;
    }
  } catch (error) {
    console.error('Erro ao obter o valor atual das ações:', error);
    return null;
  }
}

// Atualiza o valor das ações aleatoriamente a cada 20 segundos
setInterval(async () => {
  try {
    const currentStockValue = await getCurrentStockValue();
    const randomChange = Math.floor(Math.random() * 11) - 5; // Alteração aleatória entre -5 e +5
    const newStockValue = currentStockValue + randomChange;
    console.log(`O valor da bolsa atualizou para: ${newStockValue}`);

    await client.query('UPDATE stocks SET stock_value = $1', [newStockValue]);

    io.emit('stock-update', newStockValue);
  } catch (error) {
    console.error('Erro ao atualizar o valor das ações:', error);
  }
}, 20000);

// Define a pasta 'public' como o diretório de arquivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Define a rota para a raiz do site
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

http.listen(process.env.PORT || 3000, () => {
  console.log('Servidor está rodando na porta', http.address().port);
});

// Configura o Socket.io para transmitir atualizações do valor das ações para o front-end
// Configura o Socket.io para transmitir atualizações do valor das ações para o front-end
io.on('connection', (socket) => {
    console.log('Um usuário conectado');
  
    // Trata o evento de solicitação de atualização do valor das ações
    socket.on('refresh-stock', async () => {
      try {
        const currentStockValue = await getCurrentStockValue();
        // Envia imediatamente o valor atualizado das ações
        io.emit('stock-update', currentStockValue);
      } catch (error) {
        console.error('Erro ao recuperar o valor das ações:', error);
      }
    });
  
    // Adicione este console.log para verificar se o evento 'stock-update' está sendo emitido corretamente
    console.log('Emitted stock-update event');
  });
  