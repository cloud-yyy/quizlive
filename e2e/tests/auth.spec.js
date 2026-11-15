const { test, expect } = require('@playwright/test');
const { PASSWORD, uniq, apiRegister, uiLogin } = require('./helpers');

test.describe('Authentication (UI)', () => {
  test('registers, lands on the library, survives a reload, logs out', async ({ page }) => {
    const nick = uniq('reg');
    await page.goto('/register');
    await page.getByLabel('Никнейм').fill(nick);
    await page.getByLabel('E-mail').fill(`${nick}@e2e.local`);
    await page.getByLabel('Пароль').fill(PASSWORD);
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();

    await expect(page).toHaveURL(/\/quizzes$/);
    await expect(page.getByTestId('current-user')).toHaveText(nick);

    // the httpOnly refresh cookie restores the session after a full reload
    await page.reload();
    await expect(page.getByTestId('current-user')).toHaveText(nick);

    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Войти' })).toBeVisible();
  });

  test('shows server-side validation errors', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('E-mail').fill(`${uniq('weak')}@e2e.local`);
    await page.getByLabel('Пароль').fill('abcdefgh1'); // no special character
    await page.getByRole('button', { name: 'Создать аккаунт' }).click();
    await expect(page.getByRole('alert')).toContainText('special character');
  });

  test('rejects a wrong password and accepts the right one', async ({ page, request }) => {
    const u = await apiRegister(request);
    await uiLogin(page, { email: u.email, password: 'Wrong#Pass1' });
    await expect(page.getByRole('alert')).toContainText('Invalid e-mail or password');
    await uiLogin(page, { email: u.email });
    await expect(page.getByTestId('current-user')).toHaveText(u.nickname);
  });

  test('anonymous visitors can browse published quizzes', async ({ page }) => {
    await page.goto('/quizzes');
    await expect(page.getByRole('heading', { name: 'Библиотека квизов' }).or(page.getByText('Пока нет опубликованных квизов'))).toBeVisible();
  });
});
