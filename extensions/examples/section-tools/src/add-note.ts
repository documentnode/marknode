import type { Context } from 'marknode';
import { chooseSection } from './section';

export default async function (context: Context): Promise<void> {
  const section = chooseSection(context);
  if (section === null) {
    return;
  }
  const answers = context.ui.prompt([{ name: 'note', label: 'Note', type: 'multiline' }]);
  if (answers === null || answers.note.trim() === '') {
    return;
  }
  context.doc.insert(section, 'into', `> **Note:** ${answers.note.trim()}`);
  context.ui.toast('Note added.');
}
