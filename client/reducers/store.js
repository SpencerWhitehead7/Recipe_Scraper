import { combineReducers, createStore, applyMiddleware, compose } from 'redux'
import thunkMiddleware from 'redux-thunk'
import { createLogger } from 'redux-logger'

import { modalReducer } from 'comps/Modal'
import asyncHandlerReducer from './asyncHandlers'

const rootReducer = combineReducers({
  asyncHandler: asyncHandlerReducer,
  modal: modalReducer,
})

// eslint-disable-next-line no-underscore-dangle
const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose

const logger = createLogger({
  collapsed: true,
})

const store = createStore(
  rootReducer,
  composeEnhancers(applyMiddleware(
    thunkMiddleware,
    logger,
  )),
)

export default store
