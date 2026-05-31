import {
  Switch,
  TextInput,
  NumberInput,
  Select,
  Button,
  Textarea,
  MultiSelect,
  Group,
  ActionIcon,
  Modal,
} from "@mantine/core"
import { Dropzone } from "@mantine/dropzone"
import { showSuccessMessage } from "../ui-utilities"
import FontAwesome from "./FontAwesome"
import { Settings } from "../pages/SettingsPage"
import { useState } from "react"

const SettingsEditor = ({
  settings,
  setSettings,
}: {
  settings: Settings
  setSettings: (s: Settings) => void
}) => {
  const [logoModalOpen, setLogoModalOpen] = useState(false)
  const [pendingLogoContent, setPendingLogoContent] = useState("")
  const [pendingLogoExtension, setPendingLogoExtension] = useState("")
  const [pendingLogoName, setPendingLogoName] = useState("")

  return (
    <>
      <Modal
        opened={logoModalOpen}
        onClose={() => setLogoModalOpen(false)}
        title="העלאת לוגו חדש"
        centered
      >
        <TextInput
          label="שם הלוגו"
          placeholder="חיל הרפואה"
          value={pendingLogoName}
          onChange={(e) => setPendingLogoName(e.currentTarget.value)}
          data-autofocus
        />
        <Button
          fullWidth
          mt="md"
          disabled={!pendingLogoName.trim()}
          onClick={() => {
            const newLogo = {
              id: "logo-" + Date.now(),
              name: pendingLogoName.trim(),
              data: pendingLogoContent,
              extension: pendingLogoExtension,
            }
            
            setSettings({
              ...settings,
              uploadedLogos: [...(settings.uploadedLogos ?? []), newLogo]
            })
            showSuccessMessage("הלוגו הועלה בהצלחה!")
            setLogoModalOpen(false)
          }}
        >
          אישור
        </Button>
      </Modal>
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
      <MultiSelect
        mt="xs"
        label="לוגואים נבחרים"
        styles={{ pill: { direction: "ltr" } }}
        leftSection={<FontAwesome icon="icons" />}
        placeholder="בחרו לוגואים"
        data={[
          { value: "/logo.png", label: 'בה"ד 1' },
          { value: "/alon.png", label: "אלון" },
          { value: "/erez.png", label: "ארז" },
          ...(settings.uploadedLogos ?? []).map(l => ({ value: l.id, label: l.name }))
        ]}
        value={settings.logos ?? []}
        onChange={(logos) => setSettings({ ...settings, logos })}
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
            setPendingLogoContent(content.split(",")[1])
            setPendingLogoExtension(files[0].name.split(".").at(-1) ?? "png")
            setPendingLogoName("")
            setLogoModalOpen(true)
          }
          reader.readAsDataURL(files[0])
        }}
      >
        <p>
          <FontAwesome
            icon="upload"
            props={{ style: { marginInlineEnd: 5 } }}
          />{" "}
          גררו לכאן תמונה כדי להעלות לוגו חדש
        </p>
      </Dropzone>
      {(settings.uploadedLogos ?? []).length > 0 && (
        <div style={{ marginTop: 10 }}>
          <h4>לוגואים שהועלו:</h4>
          {(settings.uploadedLogos ?? []).map((logo) => (
            <Group key={logo.id} mt={5}>
              <img
                src={`data:image/${logo.extension};base64,${logo.data}`}
                style={{ height: 30, width: 30, objectFit: 'contain' }}
              />
              <span>{logo.name}</span>
              <ActionIcon
                color="red"
                onClick={() => {
                  setSettings({
                    ...settings,
                    uploadedLogos: settings.uploadedLogos!.filter(l => l.id !== logo.id),
                    logos: (settings.logos ?? []).filter(l => l !== logo.id)
                  })
                }}
              >
                <FontAwesome icon="trash" />
              </ActionIcon>
            </Group>
          ))}
        </div>
      )}
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
