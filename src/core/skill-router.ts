import { logger } from '../utils/logger.js';

export interface RouteResult {
  activeSkills: string[];
  reasons: Record<string, string>;
  confidence: Record<string, number>;
}

interface SkillRule {
  name: string;
  keywords: string[];
  fileExtensions: string[];
  filePatterns: string[];
  weight: number; // Higher weight = more relevant skill when matched
}

const SKILL_RULES: SkillRule[] = [
  {
    name: 'ai-ml',
    weight: 1.0,
    keywords: [
      'ai', 'ml', 'llm', 'prompt', 'model', 'ollama', 'training', 'dataset',
      'tensorflow', 'pytorch', 'openai', 'claude', 'gemini', 'embedding', 'vector',
      'nomic', 'langchain', 'rag', 'fine-tune', 'inference', 'neural', 'transformer',
      'huggingface', 'tokenizer', 'semantic search', 'similarity', 'classification',
      'regression', 'clustering', 'NLP', 'computer vision'
    ],
    fileExtensions: ['.ipynb'],
    filePatterns: ['model', 'embed', 'predict', 'dataset', 'train', 'inference']
  },
  {
    name: 'architecture',
    weight: 0.8,
    keywords: [
      'architecture', 'pattern', 'design', 'solid', 'dry', 'modular', 'structure',
      'clean', 'hexagonal', 'mvc', 'decoupling', 'event-driven', 'microservice',
      'monorepo', 'dependency injection', 'facade', 'factory', 'singleton',
      'observer', 'decorator', 'strategy', 'adapter', 'repository pattern'
    ],
    fileExtensions: [],
    filePatterns: ['architecture', 'design', 'structure', 'constants', 'types', 'interfaces']
  },
  {
    name: 'backend',
    weight: 1.0,
    keywords: [
      'api', 'backend', 'server', 'routes', 'express', 'fastify', 'hono', 'nestjs',
      'graphql', 'rest', 'grpc', 'websocket', 'middleware', 'queue', 'worker',
      'cron', 'nodejs', 'deno', 'bun', 'endpoint', 'controller', 'service',
      'repository', 'dto', 'entity', 'schema', 'validation', 'authentication',
      'authorization', 'rate limit', 'cors', 'webhook'
    ],
    fileExtensions: ['.graphql'],
    filePatterns: ['backend', 'routes', 'services', 'controllers', 'server', 'api', 'handlers']
  },
  {
    name: 'database',
    weight: 1.0,
    keywords: [
      'database', 'sql', 'postgres', 'postgresql', 'mysql', 'sqlite', 'mongo',
      'mongodb', 'redis', 'prisma', 'drizzle', 'knex', 'typeorm', 'sequelize',
      'migration', 'schema', 'index', 'query', 'join', 'transaction', 'aggregate',
      'qdrant', 'pinecone', 'pgvector', 'orm', 'connection pool', 'replication',
      'sharding', 'partitioning', 'vacuum', 'explain analyze'
    ],
    fileExtensions: ['.prisma', '.sql'],
    filePatterns: ['db', 'models', 'schema', 'migrations', 'seeds', 'database', 'repositories']
  },
  {
    name: 'debugging',
    weight: 1.0,
    keywords: [
      'bug', 'fix', 'error', 'crash', 'debug', 'fail', 'exception', 'stack trace',
      'heap', 'leak', 'issue', 'log', 'diagnostic', 'healing', 'broken', 'wrong',
      'undefined', 'null', 'TypeError', 'ReferenceError', 'segfault', 'infinite loop',
      'hang', 'timeout', 'slow', 'profil', 'trace', 'investigate', 'why', 'not working'
    ],
    fileExtensions: ['.log'],
    filePatterns: ['error', 'log', 'debug', 'trace']
  },
  {
    name: 'devops',
    weight: 0.9,
    keywords: [
      'docker', 'ci', 'cd', 'github actions', 'kubernetes', 'k8s', 'helm', 'deploy',
      'aws', 'gcp', 'azure', 'pipeline', 'terraform', 'pulumi', 'ansible', 'shell',
      'bash', 'nginx', 'reverse proxy', 'load balancer', 'container', 'image',
      'registry', 'ecr', 'ecs', 'lambda', 'serverless', 'monitoring', 'alerting',
      'prometheus', 'grafana', 'datadog', 'elk', 'build', 'artifact', 'release'
    ],
    fileExtensions: ['.sh', '.yml', '.yaml', '.dockerfile'],
    filePatterns: ['docker', 'kubernetes', 'deploy', 'pipeline', 'github', '.github', 'compose']
  },
  {
    name: 'frontend',
    weight: 1.0,
    keywords: [
      'frontend', 'ui', 'ux', 'css', 'html', 'react', 'nextjs', 'tailwind', 'component',
      'style', 'flexbox', 'grid', 'design system', 'layout', 'responsive', 'dom',
      'animation', 'framer', 'gsap', 'canvas', 'svg', 'accessibility', 'a11y',
      'vue', 'svelte', 'angular', 'vite', 'webpack', 'bundle', 'spa', 'ssr', 'ssg',
      'zustand', 'redux', 'jotai', 'signal', 'shadcn', 'radix', 'headless'
    ],
    fileExtensions: ['.tsx', '.jsx', '.css', '.scss', '.sass', '.html', '.svg'],
    filePatterns: ['frontend', 'components', 'styles', 'pages', 'views', 'layouts', 'hooks', 'ui']
  },
  {
    name: 'mobile',
    weight: 0.9,
    keywords: [
      'mobile', 'react native', 'expo', 'ios', 'android', 'app store', 'play store',
      'native', 'flutter', 'swift', 'kotlin', 'capacitor', 'ionic', 'cordova',
      'push notification', 'deep link', 'universal link', 'async storage', 'mmkv',
      'flatlist', 'scrollview', 'touchable', 'gesture', 'reanimated', 'navigation',
      'stack navigator', 'tab navigator', 'eas build', 'ota update', 'expo router'
    ],
    fileExtensions: ['.swift', '.kt'],
    filePatterns: ['mobile', 'native', 'expo', 'android', 'ios', 'screens', 'navigators']
  },
  {
    name: 'performance',
    weight: 0.9,
    keywords: [
      'performance', 'optimize', 'slow', 'fast', 'speed', 'benchmark', 'profil',
      'bottleneck', 'latency', 'throughput', 'cache', 'memoize', 'lazy', 'bundle size',
      'core web vitals', 'lcp', 'fid', 'cls', 'inp', 'lighthouse', 'memory leak',
      'cpu', 'heap', 'worker thread', 'streaming', 'virtualize', 'pagination',
      'n+1', 'query optimization', 'index', 'compress', 'minify', 'tree-shake'
    ],
    fileExtensions: [],
    filePatterns: ['performance', 'benchmark', 'optimize', 'cache', 'perf']
  },
  {
    name: 'refactoring',
    weight: 0.8,
    keywords: [
      'refactor', 'clean up', 'rewrite', 'reorganize', 'restructure', 'improve',
      'simplify', 'extract', 'rename', 'move', 'split', 'merge', 'consolidate',
      'technical debt', 'code smell', 'solid principle', 'dry principle', 'kiss',
      'dead code', 'unused', 'duplication', 'complexity', 'readable', 'maintainable',
      'module', 'separation of concerns', 'decouple', 'abstract'
    ],
    fileExtensions: [],
    filePatterns: ['refactor', 'legacy', 'cleanup', 'migrate']
  },
  {
    name: 'security',
    weight: 1.0,
    keywords: [
      'security', 'auth', 'jwt', 'oauth', 'login', 'signin', 'signup', 'password',
      'hash', 'encrypt', 'xss', 'csrf', 'injection', 'vulnerable', 'scan', 'secret',
      'key', 'token', 'session', 'cookie', 'https', 'tls', 'ssl', 'cors', 'firewall',
      'rate limit', 'brute force', 'ddos', 'sanitize', 'validate', 'escape',
      'privilege', 'permission', 'role', 'rbac', 'acl', 'audit', 'penetration test'
    ],
    fileExtensions: [],
    filePatterns: ['auth', 'login', 'security', 'token', 'secret', 'jwt', 'password', 'guard']
  },
  {
    name: 'testing',
    weight: 0.9,
    keywords: [
      'test', 'vitest', 'jest', 'mocha', 'cypress', 'playwright', 'assert', 'mock',
      'unit', 'integration', 'e2e', 'coverage', 'spec', 'fixture', 'stub', 'spy',
      'snapshot', 'tdd', 'bdd', 'describe', 'expect', 'it should', 'beforeEach',
      'afterEach', 'test suite', 'regression', 'smoke test', 'contract test'
    ],
    fileExtensions: ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.test.js', '.spec.js'],
    filePatterns: ['tests', '__tests__', 'spec', 'mock', 'fixtures', 'e2e', 'cypress']
  }
];

/** Maximum skills injected per request (token budget protection) */
const MAX_SKILLS_PER_REQUEST = 4;

export class SkillRouter {
  /**
   * Route user query and active file list to identify active skills.
   * Returns at most MAX_SKILLS_PER_REQUEST skills, sorted by confidence.
   */
  static route(query: string, keyFiles: string[] = []): RouteResult {
    const activeSkills: string[] = [];
    const reasons: Record<string, string> = {};
    const confidence: Record<string, number> = {};
    const normalizedQuery = query.toLowerCase();

    for (const rule of SKILL_RULES) {
      let score = 0;
      let reasonMsg = '';

      // 1. Check query keywords (weighted by how many match)
      const matchedKeywords: string[] = [];
      for (const keyword of rule.keywords) {
        const regex = new RegExp(`\\b${keyword.replace(/[-]/g, '[-]?')}\\b`, 'i');
        if (regex.test(normalizedQuery)) {
          matchedKeywords.push(keyword);
          score += rule.weight;
        }
      }

      if (matchedKeywords.length > 0) {
        // Bonus for multiple keyword matches (strong signal)
        if (matchedKeywords.length > 2) score *= 1.5;
        reasonMsg = `Keywords: ${matchedKeywords.slice(0, 3).map(k => `"${k}"`).join(', ')}`;
      }

      // 2. Check active files (strong signal: +2 points per match)
      if (keyFiles.length > 0) {
        for (const file of keyFiles) {
          const fileLower = file.toLowerCase();

          const hasExt = rule.fileExtensions.some(ext => fileLower.endsWith(ext));
          if (hasExt) {
            score += 2.0;
            reasonMsg += (reasonMsg ? ' + ' : '') + `File ext match: "${file}"`;
            break;
          }

          const hasPat = rule.filePatterns.some(pat => fileLower.includes(pat));
          if (hasPat) {
            score += 1.5;
            reasonMsg += (reasonMsg ? ' + ' : '') + `File pattern: "${file}"`;
            break;
          }
        }
      }

      if (score > 0) {
        confidence[rule.name] = Math.round(score * 10) / 10;
        reasons[rule.name] = reasonMsg;
        activeSkills.push(rule.name);
      }
    }

    // Sort by confidence descending, keep top MAX_SKILLS_PER_REQUEST
    const sorted = activeSkills
      .sort((a, b) => (confidence[b] || 0) - (confidence[a] || 0))
      .slice(0, MAX_SKILLS_PER_REQUEST);

    // Default: if no skills selected, fallback to architecture
    if (sorted.length === 0) {
      sorted.push('architecture');
      reasons['architecture'] = 'Default general-purpose context';
      confidence['architecture'] = 1.0;
    }

    logger.info(`Skill Router: [${sorted.map(s => `${s}(${confidence[s]})`).join(', ')}]`);
    return { activeSkills: sorted, reasons, confidence };
  }

  /** List all available skill names */
  static listSkills(): string[] {
    return SKILL_RULES.map(r => r.name);
  }
}

// Add data-science rule
SKILL_RULES.push({
  name: 'data-science',
  weight: 0.9,
  keywords: [
    'pandas', 'numpy', 'polars', 'duckdb', 'dataframe', 'data analysis', 'machine learning',
    'sklearn', 'scikit', 'jupyter', 'notebook', 'matplotlib', 'seaborn', 'plotly',
    'statistics', 'regression', 'classification', 'clustering', 'feature engineering',
    'mlflow', 'parquet', 'csv', 'etl', 'pipeline', 'model training', 'cross validation',
    'neural network', 'deep learning', 'gradient descent', 'overfit', 'hyperparameter',
    'visualization', 'chart', 'graph', 'dashboard', 'data cleaning', 'normalization',
    'correlation', 'hypothesis test', 'a/b test', 'experiment tracking', 'eda', 'exploration'
  ],
  fileExtensions: ['.ipynb', '.parquet', '.csv'],
  filePatterns: ['data', 'ml', 'notebook', 'train', 'model', 'analytics', 'experiment']
});
