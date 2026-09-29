// Reanimated 4 / worklets need their native runtime; use the mocks both libraries ship.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
