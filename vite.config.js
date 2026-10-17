import {defineConfig} from 'vite';
export default defineConfig({server:{port:5174,strictPort:true,host:'127.0.0.1',proxy:{'/api/careers-submit':{target:'https://kfnsfnytnnpwptklmbip.supabase.co',changeOrigin:true,rewrite:()=>'/functions/v1/careers-submit',headers:{Origin:'https://careers.hotdoogy.com'}}}},build:{target:'es2022',outDir:'dist',assetsInlineLimit:0}});
