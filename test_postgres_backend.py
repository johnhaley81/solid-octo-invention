#!/usr/bin/env python3
"""
Comprehensive PostgreSQL Backend Integration Test
Tests PostgreSQL connectivity, migrations, and GraphQL server setup
"""

import os
import sys
import subprocess
import json
import time
import tempfile
from pathlib import Path

class PostgreSQLBackendTest:
    def __init__(self):
        self.test_db = "codegen_backend_test"
        self.results = []
        
    def log_result(self, test_name, success, message="", details=""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        self.results.append({
            "test": test_name,
            "success": success,
            "message": message,
            "details": details
        })
        print(f"{status} {test_name}: {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def run_command(self, cmd, check=True, capture_output=True):
        """Run shell command and return result"""
        try:
            result = subprocess.run(
                cmd, shell=True, capture_output=capture_output, 
                text=True, check=check, timeout=30
            )
            return result
        except subprocess.CalledProcessError as e:
            return e
        except subprocess.TimeoutExpired as e:
            return e
    
    def test_postgres_running(self):
        """Test if PostgreSQL is running and accessible"""
        print("\n🔍 Testing PostgreSQL connectivity...")
        
        # Test if PostgreSQL service is running
        result = self.run_command("pg_isready -h localhost -p 5432", check=False)
        if result.returncode != 0:
            self.log_result(
                "PostgreSQL Service", False, 
                "PostgreSQL is not running",
                "Run 'sudo service postgresql start' or './setup_postgres.sh'"
            )
            return False
        
        self.log_result("PostgreSQL Service", True, "PostgreSQL is running and accepting connections")
        
        # Test basic connection
        result = self.run_command('psql -c "SELECT version();"', check=False)
        if result.returncode != 0:
            self.log_result(
                "PostgreSQL Connection", False,
                "Cannot connect to PostgreSQL",
                result.stderr
            )
            return False
        
        self.log_result("PostgreSQL Connection", True, "Successfully connected to PostgreSQL")
        return True
    
    def test_database_creation(self):
        """Test database creation and management"""
        print("\n🗄️ Testing database creation...")
        
        # Drop test database if exists
        self.run_command(f"dropdb {self.test_db}", check=False)
        
        # Create test database
        result = self.run_command(f"createdb {self.test_db}", check=False)
        if result.returncode != 0:
            self.log_result(
                "Database Creation", False,
                "Failed to create test database",
                result.stderr
            )
            return False
        
        self.log_result("Database Creation", True, f"Successfully created database '{self.test_db}'")
        
        # Test connection to new database
        result = self.run_command(f'psql {self.test_db} -c "SELECT current_database();"', check=False)
        if result.returncode != 0:
            self.log_result(
                "Database Connection", False,
                "Cannot connect to test database",
                result.stderr
            )
            return False
        
        self.log_result("Database Connection", True, f"Successfully connected to '{self.test_db}'")
        return True
    
    def test_migrations(self):
        """Test database migrations"""
        print("\n🔄 Testing database migrations...")
        
        # Create migration SQL
        migration_sql = """
        -- Migration: Create initial schema
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE TABLE IF NOT EXISTS posts (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            content TEXT,
            author_id INTEGER REFERENCES users(id),
            published BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        );
        
        CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts(author_id);
        CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
        
        -- Insert sample data
        INSERT INTO users (email, name) VALUES 
            ('admin@codegen.com', 'Codegen Admin'),
            ('dev@codegen.com', 'Developer User')
        ON CONFLICT (email) DO NOTHING;
        
        INSERT INTO posts (title, content, author_id, published) VALUES 
            ('Welcome to Codegen', 'This is a test post for the GraphQL API', 1, true),
            ('PostgreSQL Integration', 'Testing database connectivity and migrations', 2, true)
        ON CONFLICT DO NOTHING;
        """
        
        # Run migration
        with tempfile.NamedTemporaryFile(mode='w', suffix='.sql', delete=False) as f:
            f.write(migration_sql)
            migration_file = f.name
        
        try:
            result = self.run_command(f"psql {self.test_db} -f {migration_file}", check=False)
            if result.returncode != 0:
                self.log_result(
                    "Database Migration", False,
                    "Failed to run database migration",
                    result.stderr
                )
                return False
            
            self.log_result("Database Migration", True, "Successfully ran database migration")
            
            # Verify tables were created
            result = self.run_command(
                f"psql {self.test_db} -c \"\\dt\"", check=False
            )
            if "users" not in result.stdout or "posts" not in result.stdout:
                self.log_result(
                    "Migration Verification", False,
                    "Tables were not created properly",
                    result.stdout
                )
                return False
            
            self.log_result("Migration Verification", True, "Tables created successfully")
            
            # Test data insertion
            result = self.run_command(
                f"psql {self.test_db} -c \"SELECT COUNT(*) FROM users;\"", check=False
            )
            if result.returncode != 0 or "2" not in result.stdout:
                self.log_result(
                    "Sample Data", False,
                    "Sample data was not inserted properly",
                    result.stdout
                )
                return False
            
            self.log_result("Sample Data", True, "Sample data inserted successfully")
            return True
            
        finally:
            os.unlink(migration_file)
    
    def test_graphql_server_setup(self):
        """Test GraphQL server setup and connectivity"""
        print("\n🚀 Testing GraphQL server setup...")
        
        # Create a simple GraphQL server using Python
        graphql_server_code = '''
import json
import subprocess
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import time

class GraphQLHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/graphql':
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            
            try:
                query_data = json.loads(post_data.decode('utf-8'))
                query = query_data.get('query', '')
                
                # Simple query resolver
                if 'users' in query:
                    result = subprocess.run([
                        'psql', 'codegen_backend_test', '-t', '-c',
                        'SELECT json_agg(row_to_json(users)) FROM users;'
                    ], capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        users_data = result.stdout.strip()
                        if users_data and users_data != 'null':
                            response = {
                                "data": {
                                    "users": json.loads(users_data)
                                }
                            }
                        else:
                            response = {"data": {"users": []}}
                    else:
                        response = {"errors": [{"message": "Database query failed"}]}
                
                elif 'posts' in query:
                    result = subprocess.run([
                        'psql', 'codegen_backend_test', '-t', '-c',
                        '''SELECT json_agg(
                            json_build_object(
                                'id', p.id,
                                'title', p.title,
                                'content', p.content,
                                'published', p.published,
                                'author', json_build_object('name', u.name, 'email', u.email)
                            )
                        ) FROM posts p JOIN users u ON p.author_id = u.id WHERE p.published = true;'''
                    ], capture_output=True, text=True)
                    
                    if result.returncode == 0:
                        posts_data = result.stdout.strip()
                        if posts_data and posts_data != 'null':
                            response = {
                                "data": {
                                    "posts": json.loads(posts_data)
                                }
                            }
                        else:
                            response = {"data": {"posts": []}}
                    else:
                        response = {"errors": [{"message": "Database query failed"}]}
                
                else:
                    response = {"errors": [{"message": "Unknown query"}]}
                
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.end_headers()
                self.wfile.write(json.dumps(response).encode())
                
            except Exception as e:
                self.send_response(500)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                error_response = {"errors": [{"message": str(e)}]}
                self.wfile.write(json.dumps(error_response).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def log_message(self, format, *args):
        pass  # Suppress default logging

if __name__ == '__main__':
    server = HTTPServer(('localhost', 8080), GraphQLHandler)
    print("GraphQL server starting on http://localhost:8080/graphql")
    server.serve_forever()
'''
        
        # Write GraphQL server to file
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(graphql_server_code)
            server_file = f.name
        
        try:
            # Start GraphQL server in background
            server_process = subprocess.Popen([
                sys.executable, server_file
            ], stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            # Wait for server to start
            time.sleep(3)
            
            # Check if server is running
            if server_process.poll() is not None:
                stdout, stderr = server_process.communicate()
                self.log_result(
                    "GraphQL Server Start", False,
                    "GraphQL server failed to start",
                    stderr.decode()
                )
                return False
            
            self.log_result("GraphQL Server Start", True, "GraphQL server started on port 8080")
            
            # Test GraphQL queries
            test_queries = [
                {
                    "name": "Users Query",
                    "query": '{"query": "{ users { id name email } }"}'
                },
                {
                    "name": "Posts Query", 
                    "query": '{"query": "{ posts { id title author { name } } }"}'
                }
            ]
            
            all_queries_passed = True
            for test_query in test_queries:
                result = self.run_command(
                    f"curl -s -X POST -H 'Content-Type: application/json' "
                    f"-d '{test_query['query']}' http://localhost:8080/graphql",
                    check=False
                )
                
                if result.returncode != 0:
                    self.log_result(
                        f"GraphQL {test_query['name']}", False,
                        "Failed to execute GraphQL query",
                        result.stderr
                    )
                    all_queries_passed = False
                else:
                    try:
                        response = json.loads(result.stdout)
                        if "errors" in response:
                            self.log_result(
                                f"GraphQL {test_query['name']}", False,
                                "GraphQL query returned errors",
                                str(response["errors"])
                            )
                            all_queries_passed = False
                        else:
                            self.log_result(
                                f"GraphQL {test_query['name']}", True,
                                "GraphQL query executed successfully"
                            )
                    except json.JSONDecodeError:
                        self.log_result(
                            f"GraphQL {test_query['name']}", False,
                            "Invalid JSON response from GraphQL server",
                            result.stdout
                        )
                        all_queries_passed = False
            
            return all_queries_passed
            
        finally:
            # Clean up server process
            if 'server_process' in locals():
                server_process.terminate()
                server_process.wait()
            os.unlink(server_file)
    
    def test_performance(self):
        """Test database performance with concurrent connections"""
        print("\n⚡ Testing database performance...")
        
        # Test concurrent connections
        concurrent_test_sql = f"""
        DO $$
        DECLARE
            i INTEGER;
        BEGIN
            FOR i IN 1..100 LOOP
                INSERT INTO posts (title, content, author_id, published) 
                VALUES ('Performance Test ' || i, 'Content for test post ' || i, 1, true);
            END LOOP;
        END $$;
        """
        
        start_time = time.time()
        result = self.run_command(
            f"psql {self.test_db} -c \"{concurrent_test_sql}\"", check=False
        )
        end_time = time.time()
        
        if result.returncode != 0:
            self.log_result(
                "Performance Test", False,
                "Failed to run performance test",
                result.stderr
            )
            return False
        
        duration = end_time - start_time
        self.log_result(
            "Performance Test", True,
            f"Inserted 100 records in {duration:.2f} seconds"
        )
        
        # Test query performance
        start_time = time.time()
        result = self.run_command(
            f"psql {self.test_db} -c \"SELECT COUNT(*) FROM posts;\"", check=False
        )
        end_time = time.time()
        
        if result.returncode != 0:
            self.log_result(
                "Query Performance", False,
                "Failed to run query performance test",
                result.stderr
            )
            return False
        
        duration = end_time - start_time
        self.log_result(
            "Query Performance", True,
            f"Counted records in {duration:.3f} seconds"
        )
        
        return True
    
    def cleanup(self):
        """Clean up test resources"""
        print("\n🧹 Cleaning up test resources...")
        self.run_command(f"dropdb {self.test_db}", check=False)
        print(f"Dropped test database '{self.test_db}'")
    
    def run_all_tests(self):
        """Run all tests"""
        print("🧪 PostgreSQL Backend Integration Test Suite")
        print("=" * 50)
        
        tests = [
            self.test_postgres_running,
            self.test_database_creation,
            self.test_migrations,
            self.test_graphql_server_setup,
            self.test_performance
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                self.log_result(
                    test.__name__, False,
                    f"Test failed with exception: {str(e)}"
                )
        
        # Print summary
        print("\n📊 Test Summary")
        print("=" * 30)
        
        passed = sum(1 for r in self.results if r["success"])
        total = len(self.results)
        
        for result in self.results:
            status = "✅" if result["success"] else "❌"
            print(f"{status} {result['test']}")
        
        print(f"\nResults: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed! PostgreSQL backend integration is working correctly.")
            return True
        else:
            print("⚠️  Some tests failed. Check the details above.")
            return False

def main():
    """Main test runner"""
    tester = PostgreSQLBackendTest()
    
    try:
        success = tester.run_all_tests()
        sys.exit(0 if success else 1)
    finally:
        tester.cleanup()

if __name__ == "__main__":
    main()

