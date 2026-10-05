// ESLint flat config. The banned-API rules implement project spec section 5.6:
// they keep binary32 rounding, non-determinism, locale formatting and
// lossy JSON serialisation out of generated output.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const TRANSCENDENTAL = [
  'sin',
  'cos',
  'tan',
  'asin',
  'acos',
  'atan',
  'atan2',
  'sinh',
  'cosh',
  'tanh',
  'asinh',
  'acosh',
  'atanh',
  'exp',
  'expm1',
  'log',
  'log1p',
  'log2',
  'log10',
  'pow',
  'cbrt',
  'hypot',
];

const bannedProperties = [
  { object: 'Math', property: 'fround', message: 'Rounds through binary32 (requirements §5.4).' },
  {
    object: 'Math',
    property: 'round',
    message: 'Rounds half toward +Infinity; use round() from numeric/f64.',
  },
  { object: 'Math', property: 'random', message: 'Non-deterministic; use prng/splitmix64.' },
  { object: 'JSON', property: 'stringify', message: 'Loses NaN, ±Infinity and -0; use numeric/json.' },
  { object: 'performance', property: 'now', message: 'Time must not affect output (requirements §5.3).' },
  { property: 'toLocaleString', message: 'Locale-dependent formatting.' },
  { property: 'localeCompare', message: 'Locale-dependent ordering; compare code units.' },
  { property: 'toFixed', message: 'Rounds; use formatF64.' },
  { property: 'toPrecision', message: 'Rounds; use formatF64.' },
  ...TRANSCENDENTAL.map((property) => ({
    object: 'Math',
    property,
    message: 'Engine-dependent accuracy; expected values come from the reference library (spec section 7).',
  })),
];

const bannedGlobals = [
  { name: 'Float32Array', message: 'Rounds through binary32 (requirements §5.4).' },
  { name: 'Date', message: 'Time must not affect output (requirements §5.3).' },
  { name: 'Intl', message: 'Locale-dependent formatting.' },
];

const shiftOperators = ['<<', '>>', '>>>'].map((operator) => ({
  selector: `BinaryExpression[operator='${operator}']`,
  message: 'Shift operators live in numeric/int32.ts and prng/ only.',
}));

export default tseslint.config(
  { ignores: ['dist/**', 'coverage/**', 'node_modules/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-properties': ['error', ...bannedProperties],
      'no-restricted-globals': ['error', ...bannedGlobals],
      'no-restricted-syntax': ['error', ...shiftOperators],
    },
  },
  {
    files: ['src/numeric/int32.ts', 'src/prng/**/*.ts'],
    rules: { 'no-restricted-syntax': 'off' },
  },
  {
    // Tests may use JSON.stringify for messages and shifts for bit-level checks.
    files: ['test/**/*.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        ...bannedProperties.filter((p) => !(p.object === 'JSON' && p.property === 'stringify')),
      ],
      'no-restricted-syntax': 'off',
    },
  },
);
