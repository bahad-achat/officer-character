import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"

const NewDocumentPage = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    navigate("/documents", { state: { create: Object.fromEntries(params) } })
  }, [navigate])

  return <></>
}

export default NewDocumentPage
