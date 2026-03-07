// Functional test for stance.ts
import {
  getStance,
  reasonAboutFailure,
  buildStancePrompt,
  COGNITIVE_STANCES,
  DOMAIN_OWNERS,
  CROSS_ROLE_RULES,
  type CognitiveStance,
  type CrossRoleRule,
  type FailureReasoning,
  type Attribution,
  type ValidationDomain
} from './src/utils/stance.js';

// Test 1: getStance('executor') returns executor stance
const executorStance = getStance('executor');
console.log('Test 1: getStance("executor")');
console.log('  owns:', executorStance.owns);
console.log('  has mantra:', executorStance.mantra.length > 0);
console.log('  PASS:', executorStance.owns === 'technical' && executorStance.mantra.includes('act decisively'));

// Test 2: reasonAboutFailure for owned domain
const attribution: Attribution = { author_type: 'executor', responsible_for: 'technical' };
const reasoning = reasonAboutFailure('executor', attribution);
console.log('\nTest 2: reasonAboutFailure("executor", {author_type: "executor", responsible_for: "technical"})');
console.log('  is_owned:', reasoning.is_owned);
console.log('  has stance:', reasoning.stance.length > 0);
console.log('  has action:', reasoning.action.length > 0);
console.log('  PASS:', reasoning.is_owned === true);

// Test 3: buildStancePrompt returns formatted prompt
const prompt = buildStancePrompt('auditor');
console.log('\nTest 3: buildStancePrompt("auditor")');
console.log('  is string:', typeof prompt === 'string');
console.log('  includes role:', prompt.includes('auditor'));
console.log('  includes mantra:', prompt.includes('mantra'));
console.log('  PASS:', typeof prompt === 'string' && prompt.includes('auditor') && prompt.length > 100);

// All tests summary
const test1Pass = executorStance.owns === 'technical' && executorStance.mantra.includes('act decisively');
const test2Pass = reasoning.is_owned === true;
const test3Pass = typeof prompt === 'string' && prompt.includes('auditor') && prompt.length > 100;

console.log('\n=== SUMMARY ===');
console.log('Test 1 (getStance):', test1Pass ? 'PASS' : 'FAIL');
console.log('Test 2 (reasonAboutFailure):', test2Pass ? 'PASS' : 'FAIL');
console.log('Test 3 (buildStancePrompt):', test3Pass ? 'PASS' : 'FAIL');
console.log('ALL TESTS:', test1Pass && test2Pass && test3Pass ? 'PASS' : 'FAIL');
