import { useEffect } from 'react'
import App from '../App'

export default function Variant1() {
  useEffect(() => {
    document.body.classList.add('theme-v1')
    return () => document.body.classList.remove('theme-v1')
  }, [])

  return (
    <div className="v1-dash">
      <App />
    </div>
  )
}
