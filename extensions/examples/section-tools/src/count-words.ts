import type { Context } from 'marknode';
import { chooseSection, countWords } from './section';

export default async function (context: Context): Promise<void> {
  const section = chooseSection(context);
  if (section === null) {
    return;
  }
  const { markdown } = context.doc.readSection(section);
  context.ui.toast(`${countWords(markdown)} words in this section.`);
}
