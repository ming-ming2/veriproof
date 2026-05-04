import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // 백엔드 Spring 서버로 API 요청을 프록시 (개발 시 CORS 우회)
    proxy: {
      '/api': 'http://localhost:8081',
    },
  },
})
