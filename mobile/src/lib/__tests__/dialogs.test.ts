import { Alert, type AlertButton } from 'react-native';

import { confirmAction } from '@/lib/dialogs';

const options = { title: 'Delete your account?', confirmLabel: 'Delete', destructive: true };

function pressButton(label: string) {
  jest.spyOn(Alert, 'alert').mockImplementationOnce((_title, _message, buttons) => {
    (buttons as AlertButton[]).find((b) => b.text === label)?.onPress?.();
  });
}

afterEach(() => jest.restoreAllMocks());

describe('confirmAction (phone)', () => {
  it('resolves true when the action is confirmed', async () => {
    pressButton('Delete');
    await expect(confirmAction(options)).resolves.toBe(true);
  });

  it('resolves false when cancelled', async () => {
    pressButton('Cancel');
    await expect(confirmAction(options)).resolves.toBe(false);
  });

  it('marks destructive actions for the system dialog', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementationOnce(() => {});
    void confirmAction(options);
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    expect(buttons.map((b) => [b.text, b.style])).toEqual([
      ['Cancel', 'cancel'],
      ['Delete', 'destructive'],
    ]);
  });
});
