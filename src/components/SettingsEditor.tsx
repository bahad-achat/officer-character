import {
  Switch,
  TextInput,
  NumberInput,
  Select,
  Button,
  Textarea,
  TagsInput,
} from "@mantine/core"
import { Dropzone } from "@mantine/dropzone"
import { showSuccessMessage } from "../ui-utilities"
import FontAwesome from "./FontAwesome"
import { Settings } from "../pages/SettingsPage"

const SettingsEditor = ({
  settings,
  setSettings,
}: {
  settings: Settings
  setSettings: (s: Settings) => void
}) => {
  return (
    <>
      <h3 style={{ marginTop: 10, textAlign: "center" }}>פרטים אישיים</h3>
      <TextInput
        label="שם מלא"
        leftSection={<FontAwesome icon="user-graduate" />}
        value={settings.fullName ?? ""}
        onChange={(e) => {
          const fullName = e.currentTarget.value
          setSettings({ ...settings, fullName })
        }}
      />
      <NumberInput
        mt="xs"
        label="רוחב חתימה (ברירת המחדל היא 4)"
        leftSection={<FontAwesome icon="signature" />}
        value={settings.signatureWidth}
        onChange={(signatureWidth) => {
          if (typeof signatureWidth === "number") {
            setSettings({ ...settings, signatureWidth })
          }
        }}
        min={0}
      />
      <Select
        data={["זכר", "נקבה"]}
        mt="xs"
        label="לשון"
        leftSection={<FontAwesome icon="person-half-dress" />}
        value={settings.sex ?? "זכר"}
        onChange={(sex) => {
          setSettings({ ...settings, sex: sex ?? "זכר" })
        }}
      />
      <Dropzone
        mt="xs"
        accept={["image/png", "image/jpeg"]}
        style={{ textAlign: "center" }}
        multiple={false}
        onDrop={async (files) => {
          if (files.length === 0) {
            return
          }

          const reader = new FileReader()
          reader.onloadend = () => {
            const content = reader.result!.toString()
            setSettings({
              ...settings,
              signature: content.split(",")[1],
              signatureExtension: files[0].name.split(".").at(-1),
            })
            showSuccessMessage("החתימה הועלתה בהצלחה!")
          }
          reader.readAsDataURL(files[0])
        }}
      >
        <img
          style={{ maxWidth: "100%", marginTop: 10 }}
          src={`data:image/${settings.signatureExtension};base64,${settings.signature}`}
        />
        <p>
          <FontAwesome
            icon="upload"
            props={{ style: { marginInlineEnd: 5 } }}
          />{" "}
          גררו לכאן תמונה של החתימה שלכם או לחצו כדי לבחור
        </p>
      </Dropzone>
      {settings.signature !== undefined && (
        <Button
          fullWidth
          mt={5}
          color="red"
          leftSection={<FontAwesome icon="trash" />}
          onClick={() =>
            setSettings({
              ...settings,
              signature: undefined,
              signatureExtension: undefined,
            })
          }
        >
          מחיקת חתימה
        </Button>
      )}
      <TextInput
        mt="xs"
        label="דרגה"
        placeholder="צוער/ת"
        value={settings.rank ?? ""}
        onChange={(e) => {
          const rank = e.currentTarget.value
          setSettings({ ...settings, rank })
        }}
      />
      <TextInput
        mt="xs"
        label="כותרת תפקיד"
        placeholder="צוער/ת בבית הספר לקצינים"
        value={settings.jobTitle ?? ""}
        onChange={(e) => {
          const jobTitle = e.currentTarget.value
          setSettings({ ...settings, jobTitle })
        }}
      />
      <Textarea
        mt="xs"
        label="פרטי מוען"
        placeholder={
          "בית הספר לקצינים\nע״ש רא״ל לסקוב\nענף ההדרכה\nטלפון מטכ״לי: 03-9876443\nטלפון אזרחי: 03-1928376\nמספר פקס: 03-1928376"
        }
        rows={6}
        value={settings.senderDetails ?? ""}
        onChange={(e) => {
          const senderDetails = e.currentTarget.value
          setSettings({ ...settings, senderDetails })
        }}
      />
      <TagsInput
        mt="xs"
        label="לוגואים"
        styles={{ pill: { direction: "ltr" } }}
        leftSection={<FontAwesome icon="icons" />}
        placeholder="קישורים לתמונות שמשמשות כלוגו"
        value={settings.logos ?? []}
        onChange={(logos) => setSettings({ ...settings, logos })}
      />
      <h3 style={{ marginTop: 10, textAlign: "center" }}>עיצוב מסמך</h3>
      <TextInput
        mt="xs"
        label="סלוגן (מופיע בתחתית של כל עמוד)"
        value={settings.slogan ?? ""}
        placeholder="למשל ״המשימה בראש. האנשים תמיד״"
        onChange={(e) => {
          const slogan = e.currentTarget.value
          setSettings({ ...settings, slogan })
        }}
      />
      <Switch
        mt="xs"
        label="שימוש ב-David CLM"
        checked={settings.useDavidCLM ?? false}
        onChange={(e) =>
          setSettings({ ...settings, useDavidCLM: e.currentTarget.checked })
        }
      />
      <Switch
        mt="xs"
        label="מסמכים קומפקטיים (הקטנת מרווח בין שורות)"
        checked={settings.compact ?? false}
        onChange={(e) =>
          setSettings({ ...settings, compact: e.currentTarget.checked })
        }
      />
    </>
  )
}

export default SettingsEditor
