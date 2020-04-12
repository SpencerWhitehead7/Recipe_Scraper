import React, { useState, useEffect } from 'react'
import { withRouter } from 'react-router-dom'
import { connect } from 'react-redux'
import axios from 'axios'

import { logout } from '../../redux'

import Settings from './AccountSettings'
import RecipeRow from '../../comps/RecipeRow'
import PageFailure from '../PageFailure'

const Account = ({ me, location, logout }) => {
  const id = location.pathname.split(`/`).pop()
  const isMyPage = Number(id) === me.id
  const [showSettings, setShowSettings] = useState(false)
  const [user, setUser] = useState({})
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data } = await axios.get(`/api/user/${id}`)
        setUser(data)
      } catch (err) {
        console.log(err)
      }
    }
    fetchUser()
  }, [me, id])

  return (
    user ? (
      <>
        <h2>{user.userName}</h2>
        {isMyPage && (
          <button
            type="button"
            onClick={() => setShowSettings(!showSettings)}
          >
            Settings
          </button>
        )}
        {showSettings && <Settings />}
        {user.recipes && user.recipes.map(recipe => <RecipeRow key={recipe.id} {...recipe} />)}
        {isMyPage && (
          <button type="button" onClick={logout}>
            Log out
          </button>
        )}
      </>
    )
      :
      <PageFailure type="404" />
  )
}

const mstp = state => ({
  me: state.user,
})

const mdtp = dispatch => ({
  logout: () => dispatch(logout()),
})

export default connect(mstp, mdtp)(withRouter(Account))