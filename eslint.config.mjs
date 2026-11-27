import nextVitals from 'eslint-config-next/core-web-vitals'

const config = [
  ...nextVitals,
  {
    // These three rules police code for the React Compiler, which this app does
    // not run (React 18). They flag long-standing effect patterns that work;
    // kept visible as warnings so new code can avoid them without blocking lint.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
    },
  },
  { ignores: ['.next/**', 'node_modules/**', 'mcp/**', 'website/**', 'next-env.d.ts'] },
]

export default config
