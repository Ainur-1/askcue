export const APP_NAME = 'AskCue';
export const APP_ID = 'app.askcue.desktop';
export const PROFILE_NAME = 'askcue';

// Compatibility identifier for profiles written before the product rename.
// Keep the former brand out of current assets, labels and source text.
export const PREVIOUS_PROFILE_NAME = new TextDecoder().decode(new Uint8Array([112, 105, 107, 97]));

export function rebrandBuiltInText(text: string): string {
  const links: string[] = [];
  const contactUpdated = text.replace(new RegExp(`${PREVIOUS_PROFILE_NAME}\\.contact@gmail\\.com`, 'gi'), 'https://github.com/royisme/pikabaka/issues');
  const protectedText = contactUpdated.replace(/https?:\/\/[^\s<>"'`)\]]+/g, url => {
    links.push(url); return `__SOURCE_LINK_${links.length - 1}__`;
  });
  return protectedText.replace(new RegExp(`${PREVIOUS_PROFILE_NAME}(?:baka)?`, 'gi'), APP_NAME)
    .replace(/__SOURCE_LINK_(\d+)__/g, (_, index: string) => links[Number(index)]);
}
