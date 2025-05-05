import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { setLocalStorageCopy } from "../utilities"
import { Loader } from "@mantine/core"
import { showFailureMessage, showSuccessMessage } from "../ui-utilities"
import { getLocalStorage, setLocalStorage } from "../hooks"
import { OCDocuments } from "../models"

const MigrationFinish = () => {
  const navigate = useNavigate()

  useEffect(() => {
    navigator.clipboard
      .readText()
      .then((text) => {
        const data = JSON.parse(text)
        const documents = getLocalStorage<OCDocuments>("Documents")
        setLocalStorageCopy(data)
        setLocalStorage("Documents", {
          ...documents,
          ...getLocalStorage<OCDocuments>("Documents"),
        })
        showSuccessMessage("מעבר הנתונים הושלם בהצלחה!")
        navigate("/")
        navigator.clipboard.writeText("")
      })
      .catch((e) => {
        showFailureMessage(
          `מעבר הנתונים נכשל! ${e}\nבאפשרותכם ללחוץ באתר הישן ״הורדת ה-Local Storage״ בהגדרות, ובאתר החדש ללחוץ ״העלאת ה-Local Storage״.`,
        )
        navigate("/")
      })
  }, [])

  return <Loader />
}

export default MigrationFinish
