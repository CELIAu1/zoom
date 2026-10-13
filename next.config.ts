import type {NextConfig} from 'next';
import path from 'node:path';
const vercel=process.env.WAKA_BUILD_TARGET==='vercel'||process.env.VERCEL==='1';
const nextConfig:NextConfig={
  typescript: {tsconfigPath: vercel?"tsconfig.vercel.json":"tsconfig.json"},
  webpack(config){
    config.resolve.alias['@waka/runtime']=path.resolve(process.cwd(),vercel?'lib/vercel-workspace.ts':'lib/sites-workspace.ts');
    return config;
  },
};
export default nextConfig;
