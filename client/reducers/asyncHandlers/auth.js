import axios from "axios"
import buildAsyncHandler from './asyncHandlerBuilder'

const asyncFnToHandle = async ({ email, password, userName, newEmail, newPassword, newUserName, isLogout } = {}) => {
  let data
  if (email && userName && password) {
    ({ data } = await axios.post(`/api/auth/signup`, { email, userName, password }))
  } else if (email && password) {
    ({ data } = await axios.post(`/api/auth/login`, { email, password }))
  } else if (password && (newEmail || newUserName || newPassword)) {
    ({ data } = await axios.put(`/api/auth/`, { password, newEmail, newUserName, newPassword }))
  } else if (!isLogout) {
    ({ data } = await axios.get(`/api/auth`))
  }

  if (isLogout) {
    await axios.post(`/api/auth/logout`)
    return null
  }

  return data
}

export const name = `auth`

export default buildAsyncHandler(name, asyncFnToHandle)
