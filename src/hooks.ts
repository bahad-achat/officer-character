import { useEffect, useState } from "react"
import { auth } from "./firebase"
import { onAuthStateChanged } from "firebase/auth"

export const getLocalStorage = <T>(key: string, defaultValue = {}): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? JSON.stringify(defaultValue))
  } catch (e) {
    const value = localStorage.getItem(key)
    if (value !== null) {
      localStorage.setItem(key, JSON.stringify(value))
      return value as T
    }
    throw e
  }
}

export const setLocalStorage = (key: string, item: any) => {
  const newValue = JSON.stringify(item)
  localStorage.setItem(key, newValue)
  window.dispatchEvent(new StorageEvent("storage", { key, newValue }))
}

export const useLocalStorage = <T>({
  key,
  defaultValue,
}: {
  key: string
  defaultValue?: any
}): [T, React.Dispatch<React.SetStateAction<T>>] => {
  // Fix existing non-JSON string values.
  try {
    const v = localStorage.getItem(key)
    if (v) {
      JSON.parse(v)
    }
  } catch (e) {
    setLocalStorage(key, localStorage.getItem(key))
  }

  const [value, setValue] = useState<T>(
    getLocalStorage(key, defaultValue ?? null),
  )

  useEffect(() => {
    if (localStorage.getItem(key) === null && defaultValue) {
      localStorage.setItem(key, JSON.stringify(defaultValue))
    }

    const listener = (e: StorageEvent) => {
      if (e.key === key) {
        if (e.newValue) {
          setValue(JSON.parse(e.newValue))
        } else {
          setValue(defaultValue ?? null)
        }
      }
    }

    window.addEventListener("storage", listener)

    return () => window.removeEventListener("storage", listener)
  }, [key])

  const userSetValue = (newValue: any) => {
    setValue(newValue)
    if (typeof newValue === "function") {
      newValue = newValue(getLocalStorage(key, defaultValue ?? null))
    }
    if (newValue !== undefined) {
      localStorage.setItem(key, JSON.stringify(newValue))
      window.dispatchEvent(
        new StorageEvent("storage", {
          key,
          newValue: JSON.stringify(newValue),
        }),
      )
    }
  }

  return [value, userSetValue]
}

export const useCurrentUser = (): [string | undefined, boolean] => {
  const [currentUser, setCurrentUser] = useState<string | undefined>(
    auth.currentUser?.uid,
  )
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    auth.authStateReady().then(() => {
      setCurrentUser(auth.currentUser?.uid)
      setLoading(false)
    })
    return onAuthStateChanged(auth, (user) => setCurrentUser(user?.uid))
  }, [])

  return [currentUser, loading]
}
