export function aiActionErrorMessage(error: string, language: 'ru' | 'en'): string {
    if (/key.*expired|expired.*key/i.test(error)) return language === 'ru'
        ? 'Срок действия API-токена истёк. Создайте новый токен в консоли провайдера и сохраните его в настройках моделей.'
        : 'The API token has expired. Create a new token in your provider console and save it in model settings.';
    if (/429|rate.limit|too many requests|quota/i.test(error)) return language === 'ru'
        ? 'Провайдер ограничил запросы или исчерпан лимит. Проверьте квоту и попробуйте позже.'
        : 'The provider rate limit or quota has been reached. Check your allowance and try again later.';
    if (/401|403|unauthorized|authentication|invalid.*key/i.test(error)) return language === 'ru'
        ? 'Провайдер отклонил API-токен. Проверьте подключение в настройках моделей.'
        : 'The provider rejected the API token. Check the connection in model settings.';
    return error;
}
