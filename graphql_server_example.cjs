#!/usr/bin/env node
/**
 * GraphQL Server Example for PostgreSQL Backend Integration
 * Demonstrates how to connect GraphQL to PostgreSQL in codegen sandbox
 */

const http = require('http');
const { Client } = require('pg');

// Simple GraphQL-like query parser
class SimpleGraphQL {
    constructor(dbClient) {
        this.db = dbClient;
        this.resolvers = {
            users: this.getUsers.bind(this),
            posts: this.getPosts.bind(this),
            user: this.getUser.bind(this),
            createUser: this.createUser.bind(this),
            createPost: this.createPost.bind(this)
        };
    }

    async getUsers() {
        const result = await this.db.query(`
            SELECT u.id, u.name, u.email, u.created_at,
                   json_agg(
                       json_build_object(
                           'id', p.id,
                           'title', p.title,
                           'content', p.content,
                           'created_at', p.created_at
                       )
                   ) FILTER (WHERE p.id IS NOT NULL) as posts
            FROM users u
            LEFT JOIN posts p ON u.id = p.user_id
            GROUP BY u.id, u.name, u.email, u.created_at
            ORDER BY u.id
        `);
        return result.rows;
    }

    async getPosts() {
        const result = await this.db.query(`
            SELECT p.id, p.title, p.content, p.created_at,
                   json_build_object(
                       'id', u.id,
                       'name', u.name,
                       'email', u.email
                   ) as author
            FROM posts p
            JOIN users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `);
        return result.rows;
    }

    async getUser(args) {
        const result = await this.db.query(
            'SELECT * FROM users WHERE id = $1',
            [args.id]
        );
        return result.rows[0];
    }

    async createUser(args) {
        const result = await this.db.query(
            'INSERT INTO users (name, email) VALUES ($1, $2) RETURNING *',
            [args.name, args.email]
        );
        return result.rows[0];
    }

    async createPost(args) {
        const result = await this.db.query(
            'INSERT INTO posts (title, content, user_id) VALUES ($1, $2, $3) RETURNING *',
            [args.title, args.content, args.user_id]
        );
        return result.rows[0];
    }

    parseQuery(queryString) {
        // Simple query parser - in real app, use proper GraphQL parser
        const query = queryString.trim();
        
        if (query.includes('users')) {
            return { operation: 'users', args: {} };
        } else if (query.includes('posts')) {
            return { operation: 'posts', args: {} };
        } else if (query.includes('user(')) {
            const idMatch = query.match(/user\(id:\s*(\d+)\)/);
            return { 
                operation: 'user', 
                args: { id: idMatch ? parseInt(idMatch[1]) : null }
            };
        } else if (query.includes('createUser')) {
            const nameMatch = query.match(/name:\s*"([^"]+)"/);
            const emailMatch = query.match(/email:\s*"([^"]+)"/);
            return {
                operation: 'createUser',
                args: {
                    name: nameMatch ? nameMatch[1] : null,
                    email: emailMatch ? emailMatch[1] : null
                }
            };
        } else if (query.includes('createPost')) {
            const titleMatch = query.match(/title:\s*"([^"]+)"/);
            const contentMatch = query.match(/content:\s*"([^"]+)"/);
            const userIdMatch = query.match(/user_id:\s*(\d+)/);
            return {
                operation: 'createPost',
                args: {
                    title: titleMatch ? titleMatch[1] : null,
                    content: contentMatch ? contentMatch[1] : null,
                    user_id: userIdMatch ? parseInt(userIdMatch[1]) : null
                }
            };
        }
        
        return null;
    }

    async execute(queryString) {
        try {
            const parsed = this.parseQuery(queryString);
            if (!parsed || !this.resolvers[parsed.operation]) {
                return { errors: [{ message: 'Unknown query operation' }] };
            }

            const result = await this.resolvers[parsed.operation](parsed.args);
            return { data: { [parsed.operation]: result } };
        } catch (error) {
            return { errors: [{ message: error.message }] };
        }
    }
}

// Database setup and migration
async function setupDatabase(client) {
    console.log('🔄 Setting up database schema...');
    
    await client.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            user_id INTEGER REFERENCES users(id),
            created_at TIMESTAMP DEFAULT NOW()
        )
    `);

    // Insert sample data if tables are empty
    const userCount = await client.query('SELECT COUNT(*) FROM users');
    if (parseInt(userCount.rows[0].count) === 0) {
        console.log('📝 Inserting sample data...');
        
        await client.query(`
            INSERT INTO users (name, email) VALUES 
            ('Alice Developer', 'alice@codegen.com'),
            ('Bob Designer', 'bob@codegen.com')
        `);

        await client.query(`
            INSERT INTO posts (title, content, user_id) VALUES 
            ('Welcome to GraphQL', 'This is our first GraphQL post!', 1),
            ('PostgreSQL Integration', 'Successfully connected GraphQL to PostgreSQL', 2),
            ('Codegen Sandbox', 'Testing database operations in the sandbox', 1)
        `);
    }

    console.log('✅ Database setup complete');
}

// HTTP Server
function createServer(graphql) {
    return http.createServer(async (req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        if (req.method === 'GET' && req.url === '/') {
            // Serve a simple GraphQL playground
            const playground = `
<!DOCTYPE html>
<html>
<head>
    <title>GraphQL Playground</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        .query-box { width: 100%; height: 200px; font-family: monospace; }
        .result-box { width: 100%; height: 300px; font-family: monospace; background: #f5f5f5; }
        button { padding: 10px 20px; margin: 10px 0; }
        .examples { margin: 20px 0; }
        .example { margin: 10px 0; padding: 10px; background: #e8f4f8; border-radius: 4px; }
    </style>
</head>
<body>
    <h1>🚀 GraphQL Playground</h1>
    <p>Test your GraphQL queries against PostgreSQL</p>
    
    <div class="examples">
        <h3>Example Queries:</h3>
        <div class="example">
            <strong>Get all users:</strong><br>
            <code>{ users { id name email posts { title } } }</code>
        </div>
        <div class="example">
            <strong>Get all posts:</strong><br>
            <code>{ posts { id title content author { name } } }</code>
        </div>
        <div class="example">
            <strong>Get specific user:</strong><br>
            <code>{ user(id: 1) { id name email } }</code>
        </div>
        <div class="example">
            <strong>Create user:</strong><br>
            <code>{ createUser(name: "John Doe", email: "john@example.com") { id name } }</code>
        </div>
    </div>
    
    <textarea class="query-box" id="query" placeholder="Enter your GraphQL query here...">{ users { id name email posts { title } } }</textarea><br>
    <button onclick="executeQuery()">Execute Query</button>
    
    <h3>Result:</h3>
    <textarea class="result-box" id="result" readonly></textarea>
    
    <script>
        async function executeQuery() {
            const query = document.getElementById('query').value;
            const resultBox = document.getElementById('result');
            
            try {
                const response = await fetch('/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query })
                });
                
                const result = await response.json();
                resultBox.value = JSON.stringify(result, null, 2);
            } catch (error) {
                resultBox.value = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>`;
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(playground);
            return;
        }

        if (req.method === 'POST' && req.url === '/graphql') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', async () => {
                try {
                    const { query } = JSON.parse(body);
                    const result = await graphql.execute(query);
                    
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(result, null, 2));
                } catch (error) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        errors: [{ message: 'Invalid request: ' + error.message }] 
                    }));
                }
            });
            return;
        }

        // 404 for other routes
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });
}

// Main application
async function main() {
    console.log('🚀 Starting GraphQL Server with PostgreSQL Backend');
    console.log('=' * 50);

    // Database connection
    const client = new Client({
        host: 'localhost',
        port: 5432,
        database: 'codegen_graphql_test',
        user: process.env.USER || 'postgres',
        // No password needed with trust authentication
    });

    try {
        // Create database if it doesn't exist
        const adminClient = new Client({
            host: 'localhost',
            port: 5432,
            database: 'postgres',
            user: process.env.USER || 'postgres',
        });

        await adminClient.connect();
        
        try {
            await adminClient.query('CREATE DATABASE codegen_graphql_test');
            console.log('📊 Created database: codegen_graphql_test');
        } catch (error) {
            if (!error.message.includes('already exists')) {
                throw error;
            }
            console.log('📊 Using existing database: codegen_graphql_test');
        }
        
        await adminClient.end();

        // Connect to our database
        await client.connect();
        console.log('✅ Connected to PostgreSQL');

        // Setup database schema
        await setupDatabase(client);

        // Create GraphQL instance
        const graphql = new SimpleGraphQL(client);

        // Create and start server
        const server = createServer(graphql);
        const PORT = process.env.PORT || 3000;

        server.listen(PORT, () => {
            console.log(`🌟 GraphQL server running on http://localhost:${PORT}`);
            console.log(`🎮 GraphQL Playground: http://localhost:${PORT}`);
            console.log(`🔗 GraphQL Endpoint: http://localhost:${PORT}/graphql`);
            console.log('\n📋 Test with curl:');
            console.log(`curl -X POST http://localhost:${PORT}/graphql \\`);
            console.log(`  -H "Content-Type: application/json" \\`);
            console.log(`  -d '{"query": "{ users { id name email } }"}'`);
        });

        // Graceful shutdown
        process.on('SIGINT', async () => {
            console.log('\n🛑 Shutting down server...');
            server.close();
            await client.end();
            process.exit(0);
        });

    } catch (error) {
        console.error('❌ Failed to start server:', error.message);
        process.exit(1);
    }
}

// Check if pg module is available
try {
    require.resolve('pg');
    main();
} catch (error) {
    console.log('📦 Installing required dependencies...');
    console.log('Run: npm install pg');
    console.log('Then run this script again.');
    
    // Try to install automatically
    const { spawn } = require('child_process');
    const npm = spawn('npm', ['install', 'pg'], { stdio: 'inherit' });
    
    npm.on('close', (code) => {
        if (code === 0) {
            console.log('✅ Dependencies installed. Starting server...');
            main();
        } else {
            console.log('❌ Failed to install dependencies. Please run: npm install pg');
            process.exit(1);
        }
    });
}

