import { test } from '@japa/runner'
import {
  buildClubRegistrationQuestionColumns,
  formatClubRegistrationAnswer,
} from '#services/club_registration_export_service'

test.group('Club registration export', () => {
  test('keeps schema order and appends legacy answer keys', ({ assert }) => {
    const schema = {
      fields: [
        {
          section_name: 'profile_data',
          fields: [{ key: 'name', label: 'Nama' }],
        },
        {
          section_name: 'Motivasi',
          fields: [
            { key: 'motivation', label: 'Motivasi' },
            { key: 'division', label: 'Divisi' },
          ],
        },
      ],
    }

    assert.deepEqual(
      buildClubRegistrationQuestionColumns(schema, [
        { motivation: 'Belajar', old_question: 'Jawaban lama' },
      ]),
      [
        { key: 'motivation', label: 'Motivasi' },
        { key: 'division', label: 'Divisi' },
        { key: 'old_question', label: 'Old question' },
      ]
    )
  })

  test('formats false, zero, arrays, and objects without dropping values', ({ assert }) => {
    assert.equal(formatClubRegistrationAnswer(false), 'Tidak')
    assert.equal(formatClubRegistrationAnswer(0), 0)
    assert.equal(formatClubRegistrationAnswer(['A', 'B']), 'A, B')
    assert.equal(formatClubRegistrationAnswer({ note: 'A' }), '{"note":"A"}')
  })
})
