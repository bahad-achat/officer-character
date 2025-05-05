import { Link, RichTextEditor } from "@mantine/tiptap"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import Highlight from "@tiptap/extension-highlight"
import Table from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableRow from "@tiptap/extension-table-row"
import TableHeader from "@tiptap/extension-table-header"
import Placeholder from "@tiptap/extension-placeholder"
import TextAlign from "@tiptap/extension-text-align"
import Image from "@tiptap/extension-image"
import {
  IconColumnInsertLeft,
  IconColumnRemove,
  IconRowInsertBottom,
  IconRowRemove,
  IconTable,
} from "@tabler/icons-react"

import { Editor, JSONContent, useEditor } from "@tiptap/react"
import { Alert, Anchor, Button, TextInput } from "@mantine/core"
import FontAwesome from "./FontAwesome"
import { canonicalize } from "../errorChecking"
import { useLocalStorage } from "../hooks"
import { modals } from "@mantine/modals"
import { useState } from "react"
import { fetchImage } from "../typst"

const InsertImageModal = ({ editor }: { editor: Editor }) => {
  const [url, setUrl] = useState("")
  const submit = async () => {
    const fname = await fetchImage(url)
    editor.chain().focus().setImage({ src: url, alt: fname }).run()
    modals.closeAll()
  }

  return (
    <>
      <TextInput
        data-autofocus
        value={url}
        onChange={(e) => setUrl(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            submit()
          }
        }}
        label="כתובת התמונה"
        leftSection={<FontAwesome icon="link" />}
        placeholder="https://i.imgur.com/XXXXXX.png"
      />
      <Alert mt="xs" color="yellow" icon={<FontAwesome icon="exclamation" />}>
        לא כל הקישורים עובדים! אם הקישור לא עובד לכם, נסו להעלות את התמונה ל-
        <Anchor href="https://imgur.com">imgur</Anchor> ולהשתמש בקישור משם!
        (יכולים להיעזר{" "}
        <Anchor href="https://imgur-direct-links.vercel.app/">באתר הבא</Anchor>{" "}
        כדי לחלץ כתובת תמונה)
      </Alert>
      <Button
        fullWidth
        mt="xs"
        leftSection={<FontAwesome icon="plus" />}
        onClick={submit}
      >
        הוספה
      </Button>
    </>
  )
}

const TypstEditor = ({
  value,
  onChange,
  defaultContent,
  placeholder,
  errorChecker,
  typstChecker,
}: {
  value: string
  onChange: (v: string) => void
  defaultContent?: JSONContent
  placeholder?: string
  errorChecker?: (v: string) => string | undefined
  typstChecker?: (v: JSONContent) => string | undefined
}) => {
  try {
    value = JSON.parse(value)
  } catch (ignored) {}

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight,
      Table.configure({ resizable: false }),
      TableRow,
      TableCell,
      TableHeader,
      Link,
      Image,
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["paragraph"] }),
    ],
    content: value ? value : defaultContent,
    onUpdate: ({ editor }) => {
      onChange(JSON.stringify(editor.getJSON()))
    },
  })
  const [isTutorial] = useLocalStorage<boolean>({
    key: "Is Tutorial",
    defaultValue: true,
  })

  const error =
    editor && isTutorial
      ? (errorChecker?.(canonicalize(editor.getText())) ??
        typstChecker?.(editor.getJSON()))
      : undefined

  return (
    <>
      <RichTextEditor
        editor={editor}
        labels={{
          boldControlLabel: "מודגש",
          hrControlLabel: "קו אופקי",
          italicControlLabel: "נטוי",
          underlineControlLabel: "קו תחתון",
          strikeControlLabel: "קו חוצה",
          clearFormattingControlLabel: "איפוס עיצוב",
          linkControlLabel: "קישור",
          unlinkControlLabel: "הסרת קישור",
          bulletListControlLabel: "רשימת מנוקדת",
          orderedListControlLabel: "רשימה ממוספרת",
          highlightControlLabel: "הדגשה",
          undoControlLabel: "בטל",
          redoControlLabel: "בצע מחדש",
          linkEditorInputLabel: "כתובת קישור",
          linkEditorSave: "שמירה",
          alignLeftControlLabel: "יישור לשמאל",
          alignRightControlLabel: "יישור לימין",
          alignCenterControlLabel: "יישור למרכז",
          alignJustifyControlLabel: "יישור לשני הצדדים",
          linkEditorInputPlaceholder: "https://google.com",
        }}
      >
        <RichTextEditor.Toolbar
          dir="ltr"
          sticky
          style={{ flexWrap: "nowrap", overflowX: "auto" }}
        >
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Bold />
            <RichTextEditor.Italic />
            <RichTextEditor.Underline />
            <RichTextEditor.Strikethrough />
            <RichTextEditor.Highlight />
            <RichTextEditor.ClearFormatting />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.BulletList />
            <RichTextEditor.OrderedList />
            <RichTextEditor.Control
              aria-label="הוספת תמונה"
              title="הוספת תמונה"
              onClick={() =>
                modals.open({
                  title: "הוספת תמונה",
                  children: <InsertImageModal editor={editor!} />,
                })
              }
            >
              <FontAwesome icon="image" />
            </RichTextEditor.Control>
            <RichTextEditor.Control
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .insertTable({ rows: 3, cols: 3, withHeaderRow: false })
                  .run()
              }
              aria-label="הוספת טבלה"
              title="הוספת טבלה"
            >
              <IconTable size={14} />
            </RichTextEditor.Control>
            <RichTextEditor.Control
              onClick={() => editor?.chain().focus().addRowAfter().run()}
              aria-label="הוספת שורה מתחת"
              title="הוספת שורה מתחת"
            >
              <IconRowInsertBottom size={14} />
            </RichTextEditor.Control>
            <RichTextEditor.Control
              onClick={() => editor?.chain().focus().addColumnAfter().run()}
              aria-label="הוספת עמודה משמאל"
              title="הוספת עמודה משמאל"
            >
              <IconColumnInsertLeft size={14} />
            </RichTextEditor.Control>
            <RichTextEditor.Control
              onClick={() => editor?.chain().focus().deleteRow().run()}
              aria-label="מחיקת שורה"
              title="מחיקת שורה"
            >
              <IconRowRemove size={14} />
            </RichTextEditor.Control>
            <RichTextEditor.Control
              onClick={() => editor?.chain().focus().deleteColumn().run()}
              aria-label="מחיקת עמודה"
              title="מחיקת עמודה"
            >
              <IconColumnRemove size={14} />
            </RichTextEditor.Control>
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Link />
            <RichTextEditor.Unlink />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.AlignLeft />
            <RichTextEditor.AlignCenter />
            <RichTextEditor.AlignRight />
          </RichTextEditor.ControlsGroup>
          <RichTextEditor.ControlsGroup>
            <RichTextEditor.Undo />
            <RichTextEditor.Redo />
          </RichTextEditor.ControlsGroup>
        </RichTextEditor.Toolbar>
        <RichTextEditor.Content />
      </RichTextEditor>
      {error && (
        <Alert color="red" icon={<FontAwesome icon="exclamation" />}>
          {error}
        </Alert>
      )}
    </>
  )
}

export default TypstEditor
