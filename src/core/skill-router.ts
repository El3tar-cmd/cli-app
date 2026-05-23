import { logger } from '../utils/logger.js';

export interface RouteResult {
  activeSkills: string[];
  reasons: Record<string, string>;
}

interface SkillRule {
  name: string;
  keywords: string[];
  fileExtensions: string[];
  filePatterns: string[];
}

const SKILL_RULES: SkillRule[] = [
  {
    name: 'ai-ml',
    keywords: ['ai', 'ml', 'llm', 'prompt', 'model', 'ollama', 'training', 'dataset', 'tensorflow', 'pytorch', 'openai', 'claude', 'gemini', 'embedding', 'vector', 'nomic'],
    fileExtensions: ['.ipynb'],
    filePatterns: ['model', 'embed', 'predict', 'dataset']
  },
  {
    name: 'architecture',
    keywords: ['architecture', 'pattern', 'design', 'solid', 'dry', 'dynamic', 'modular', 'structure', 'refactor', 'clean', 'hexagonal', 'mvc', 'decoupling', 'component', 'modules'],
    fileExtensions: [],
    filePatterns: ['architecture', 'design', 'structure', 'constants', 'types']
  },
  {
    name: 'backend',
    keywords: ['api', 'backend', 'database', 'server', 'routes', 'express', 'fastify', 'prisma', 'postgre', 'sql', 'mongo', 'redis', 'cache', 'graphql', 'rest', 'grpc', 'queue', 'nodejs', 'node'],
    fileExtensions: ['.prisma', '.sql', '.graphql'],
    filePatterns: ['backend', 'routes', 'services', 'controllers', 'db', 'models', 'schema', 'server']
  },
  {
    name: 'debugging',
    keywords: ['bug', 'fix', 'error', 'crash', 'debug', 'fail', 'exception', 'stack trace', 'heap', 'leak', 'issue', 'log', 'diagnostic', 'healing'],
    fileExtensions: ['.log'],
    filePatterns: ['error', 'log', 'debug', 'trace']
  },
  {
    name: 'devops',
    keywords: ['docker', 'ci', 'cd', 'github actions', 'kubernetes', 'deploy', 'cloud', 'aws', 'gcp', 'azure', 'pipeline', 'terraform', 'shell', 'bash', 'package', 'version', 'build', 'compile'],
    fileExtensions: ['.sh', '.yml', '.yaml', '.dockerfile'],
    filePatterns: ['docker', 'kubernetes', 'deploy', 'pipeline', 'github', 'package.json', 'tsconfig.json']
  },
  {
    name: 'frontend',
    keywords: ['frontend', 'ui', 'ux', 'css', 'html', 'react', 'nextjs', 'tailwind', 'component', 'style', 'flexbox', 'grid', 'design system', 'layout', 'responsive', 'mobile', 'client', 'web', 'dom'],
    fileExtensions: ['.tsx', '.jsx', '.css', '.scss', '.sass', '.html', '.svg'],
    filePatterns: ['frontend', 'components', 'styles', 'pages', 'views', 'layouts']
  },
  {
    name: 'security',
    keywords: ['security', 'auth', 'jwt', 'oauth', 'login', 'signin', 'signup', 'password', 'hash', 'encrypt', 'xss', 'csrf', 'injection', 'vulnerable', 'scan', 'secret', 'key', 'token'],
    fileExtensions: [],
    filePatterns: ['auth', 'login', 'security', 'token', 'secret', 'jwt', 'password']
  },
  {
    name: 'testing',
    keywords: ['test', 'vitest', 'jest', 'mocha', 'cypress', 'playwright', 'assert', 'mock', 'unit', 'integration', 'e2e', 'coverage', 'spec'],
    fileExtensions: ['.test.ts', '.spec.ts', '.test.tsx', '.spec.tsx', '.test.js', '.spec.js'],
    filePatterns: ['tests', '__tests__', 'spec', 'mock']
  }
];

export class SkillRouter {
  /**
   * Route user query and active file list to identify active skills
   */
  static route(query: string, keyFiles: string[] = []): RouteResult {
    const activeSkills: string[] = [];
    const reasons: Record<string, string> = {};
    const normalizedQuery = query.toLowerCase();

    // Check each skill rule
    for (const rule of SKILL_RULES) {
      let isMatched = false;
      let reasonMsg = '';

      // 1. Check query keywords
      const matchedKeyword = rule.keywords.find(keyword => {
        // Match word boundaries
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return regex.test(normalizedQuery);
      });

      if (matchedKeyword) {
        isMatched = true;
        reasonMsg = `Matched query keyword: "${matchedKeyword}"`;
      }

      // 2. Check active files
      if (!isMatched && keyFiles.length > 0) {
        for (const file of keyFiles) {
          const fileLower = file.toLowerCase();

          // Check extensions
          const hasMatchedExtension = rule.fileExtensions.some(ext => fileLower.endsWith(ext));
          if (hasMatchedExtension) {
            isMatched = true;
            reasonMsg = `Matched file extension for: "${file}"`;
            break;
          }

          // Check path patterns
          const hasMatchedPattern = rule.filePatterns.some(pat => fileLower.includes(pat));
          if (hasMatchedPattern) {
            isMatched = true;
            reasonMsg = `Matched file path pattern for: "${file}"`;
            break;
          }
        }
      }

      if (isMatched) {
        activeSkills.push(rule.name);
        reasons[rule.name] = reasonMsg;
      }
    }

    // Default: if no skills are selected, fallback to architecture/debugging if appropriate, or default
    if (activeSkills.length === 0) {
      activeSkills.push('architecture');
      reasons['architecture'] = 'Default general-purpose context';
    }

    logger.info(`Skill Router: selected skills [${activeSkills.join(', ')}]`);
    return { activeSkills, reasons };
  }
}
