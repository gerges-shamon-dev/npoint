import React, { Component } from 'react'
import { connect } from 'react-redux'
import { MdLock } from 'react-icons/lib/md'
import { Helmet } from 'react-helmet'
import { HotKeys } from 'react-hotkeys'
import { push } from 'react-router-redux'
import _ from 'lodash'
import { withTheme } from 'react-jsonschema-form'
import { Theme as MuiTheme } from 'rjsf-material-ui'

import { IFRAME_SRC_DOC, evalParseObject } from '../helpers/sandboxedEval'
import Document from '../models/Document'
import PageLoadingPlaceholder from '../components/PageLoadingPlaceholder'
import Schema from '../models/Schema'

import DocumentPageHeader from './DocumentPage/DocumentPageHeader'
import LeaveModal from './DocumentPage/LeaveModal'
import ShareModal from './DocumentPage/ShareModal'

import {} from './FormEditPage.css'

const JsonSchemaForm = withTheme(MuiTheme)

const CONFIRM_TEXT =
  'Your bin has unsaved changes. Are you sure you want to leave?'

const INITIAL_STATE = {
  contents: null,
  contentsErrorMessage: '',
  document: {},
  isLoading: false,
  isSaving: false,
  lockdownContentsModalVisible: false,
  lockdownSchemaModalVisible: false,
  modalActionInProgress: false,
  modalCallback: null,
  openModalName: null,
  originalContents: '',
  originalSchema: '',
  savedOriginalContents: '',
  savedOriginalSchema: '',
  schema: null,
  schemaErrorMessage: '',
  serverErrors: [],
  showContentsErrorMessage: false,
  showSchemaErrorMessage: false,
  validationErrorMessage: '',
}

class FormEditPage extends Component {
  state = INITIAL_STATE

  loadDocument(token) {
    this.setState({ isLoading: true })
    Document.get(token).then(({ data }) => this.onLoadDocument(data))
  }

  loadCachedThinDocument(token) {
    let thinDocument = _.find(this.props.thinDocumentsCache, doc => {
      return doc.token === this.props.params.documentToken
    })

    if (thinDocument) {
      this.setState({ document: thinDocument })
    }
  }

  onLoadDocument = data => {
    this.setState({
      contents: data.contents,
      document: data,
      isLoading: false,
      originalContents: data.originalContents,
      originalSchema: data.originalSchema,
      savedOriginalContents: data.originalContents,
      savedOriginalSchema: data.originalSchema,
      schema: data.schema,
    })
  }

  validationsHandlerId = null
  unmountBeforeNavigation = null

  componentDidMount() {
    this.loadCachedThinDocument(this.props.params.documentToken)
    this.loadDocument(this.props.params.documentToken)
    this.validationsHandlerId = setInterval(this.runValidations, 100)

    this.unmountBeforeNavigation = this.props.router.listenBefore(
      (location, done) => {
        if (this.hasSaved) {
          done()
        } else {
          this.setOpenModal('leave', () => done())
        }
      }
    )

    window.onbeforeunload = e => {
      if (!this.hasSaved) {
        e.returnValue = CONFIRM_TEXT
        return CONFIRM_TEXT
      }
    }
  }

  componentWillUnmount() {
    clearInterval(this.validationsHandlerId)
    this.unmountBeforeNavigation()
    window.onbeforeunload = null
  }

  componentWillReceiveProps(newProps) {
    if (newProps.params.documentToken !== this.props.params.documentToken) {
      this.loadDocument(newProps.params.documentToken)
    } else if (
      this.props.session.loaded &&
      newProps.session.loggedIn !== this.props.session.loggedIn
    ) {
      this.loadDocument(this.props.params.documentToken)
    }
  }

  get contentsEditable() {
    return this.state.document.editable && !this.state.document.contentsLocked
  }
  get schemaEditable() {
    return this.contentsEditable && !this.state.document.schemaLocked
  }
  get hasSaved() {
    return (
      this.state.originalContents === this.state.savedOriginalContents &&
      this.state.originalSchema === this.state.savedOriginalSchema
    )
  }

  // Ace editor is picky and gets upset when we try to kick off a validation job
  // during the content change handler. (Any tiny slowness causes lag and makes the cursor
  // get misplaced). So we run validations completely separately. I think this may still
  // cause the occasional race condition but is hopefully good enough
  sandboxedIframe = null
  lastValidatedSchema = null
  lastValidatedContents = null
  runValidations = () => {
    let contentsChanged =
      this.lastValidatedContents !== this.state.originalContents
    let schemaChanged = this.lastValidatedSchema !== this.state.originalSchema

    if (contentsChanged) {
      evalParseObject(this.state.originalContents, this.sandboxedIframe).then(
        ({ json, errorMessage }) => {
          this.setState({
            contents: json,
            contentsErrorMessage: errorMessage,
          })
          if (_.isEmpty(errorMessage)) {
            this.validateSchemaMatch()
            if (_.isEmpty(this.state.validationErrorMessage)) {
              this.setState({ showContentsErrorMessage: false })
            }
          }
        }
      )
      this.lastValidatedContents = this.state.originalContents
    }

    if (schemaChanged) {
      evalParseObject(this.state.originalSchema, this.sandboxedIframe).then(
        ({ json, errorMessage }) => {
          this.setState({
            schema: json,
            schemaErrorMessage: errorMessage,
          })
          if (_.isEmpty(errorMessage)) {
            this.setState({ showSchemaErrorMessage: false })
            this.validateSchemaMatch()
          }
        }
      )
      this.lastValidatedSchema = this.state.originalSchema
    }
  }

  handleContentsTypingBreakpoint = () => {
    if (this.state.contentsErrorMessage) {
      this.setState({ showContentsErrorMessage: true })
    }
  }

  handleSchemaTypingBreakpoint = () => {
    if (this.state.schemaErrorMessage) {
      this.setState({
        showSchemaErrorMessage: true,
      })
    }
  }

  validateSchemaMatch = () => {
    if (_.isEmpty(this.state.originalSchema)) {
      this.setState({ validationErrorMessage: null })
      return
    }

    Schema.validate({
      contents: JSON.stringify(this.state.contents),
      schema: JSON.stringify(this.state.schema),
    }).then(({ data }) => {
      if (data.isValid) {
        this.setState({
          validationErrorMessage: null,
        })

        if (_.isEmpty(this.state.contentsErrorMessage)) {
          this.setState({ showContentsErrorMessage: false })
        }
      } else {
        this.setState({
          showContentsErrorMessage: true,
          validationErrorMessage: data.errors[0],
        })
      }
    })
  }

  autoformatContents = () => {
    this.setState({
      originalContents: JSON.stringify(this.state.contents, null, 2),
    })
  }

  autoformatSchema = () => {
    this.setState({
      originalSchema: JSON.stringify(this.state.schema, null, 2),
    })
  }

  updateContents = newOriginalContents => {
    this.setState({
      originalContents: newOriginalContents,
    })
  }

  updateSchema = newOriginalSchema => {
    this.setState({
      originalSchema: newOriginalSchema,
    })
  }

  generateSchema = async () => {
    Schema.generate({
      contents: JSON.stringify(this.state.contents),
    }).then(({ data }) => {
      this.setState({
        schema: data.schema,
        originalSchema: data.originalSchema,
      })
    })
  }

  removeSchema = () => {
    this.setState({
      schema: null,
      originalSchema: '',
    })
  }

  saveDocument = extraParams => {
    if (
      this.state.contentsErrorMessage ||
      this.state.schemaErrorMessage ||
      this.state.validationErrorMessage
    ) {
      console.warn('Document has errors; not saving')
      return
    }

    let saveState = _.cloneDeep(this.state)
    this.setState({ isSaving: true })

    return Document.update(
      this.props.params.documentToken,
      _.merge(
        {
          contents: saveState.contents
            ? JSON.stringify(saveState.contents)
            : null,
          originalContents: saveState.originalContents,
          schema: saveState.schema ? JSON.stringify(saveState.schema) : null,
          originalSchema: saveState.originalSchema,
        },
        extraParams
      )
    ).then(({ data }) => {
      this.onLoadDocument(data)
      this.setState({
        isSaving: false,
        savedOriginalContents: saveState.originalContents,
        savedOriginalSchema: saveState.originalSchema,
      })
    })
  }

  requestCloneDocument = () => {
    if (this.hasSaved) {
      this.cloneDocument()
    } else {
      this.setOpenModal('leave', () => this.cloneDocument())
    }
  }

  cloneDocument = () => {
    return Document.clone(this.props.params.documentToken).then(({ data }) => {
      this.setState(INITIAL_STATE)
      this.props.dispatch(push(`/docs/${data.token}`))
    })
  }

  handleLockContents = () => {
    this.setState({ modalActionInProgress: true })

    this.saveDocument({ contentsLocked: true }).then(() => {
      this.setOpenModal(null)
      this.setState({ modalActionInProgress: false })
    })
  }

  handleLockSchema = () => {
    this.setState({ modalActionInProgress: true })

    this.saveDocument({ schemaLocked: true }).then(() => {
      this.setOpenModal(null)
      this.setState({ modalActionInProgress: false })
    })
  }

  setOpenModal = (openModalName, modalCallback) => {
    this.setState({ openModalName, modalCallback })
  }

  hotKeyMap = {
    save: ['meta+s', 'ctrl+s'],
  }

  hotKeyHandlers = {
    save: event => {
      this.saveDocument()

      if (event.preventDefault) {
        event.preventDefault()
      } else {
        // internet explorer
        event.returnValue = false
      }
    },
  }

  render() {
    let overallErrorMessage = null
    if (
      this.state.showContentsErrorMessage ||
      this.state.showSchemaErrorMessage
    ) {
      overallErrorMessage =
        (this.state.contentsErrorMessage
          ? 'Syntax error in JSON data'
          : null) ||
        (this.state.schemaErrorMessage ? 'Syntax error in schema' : null) ||
        (this.state.validationErrorMessage
          ? 'JSON data does not match schema'
          : null)
    }

    return (
      <div className="form-edit-page">
        <iframe
          className="hidden-iframe"
          sandbox="allow-scripts"
          srcDoc={IFRAME_SRC_DOC}
          ref={el => (this.sandboxedIframe = el)}
          key={this.props.params.documentToken}
        />
        <ShareModal
          document={this.state.document}
          isOpen={this.state.openModalName === 'share'}
          onClose={() => this.setOpenModal(null)}
        />
        <LeaveModal
          document={this.state.document}
          isOpen={this.state.openModalName === 'leave'}
          onClose={() => this.setOpenModal(null)}
          onDiscard={() => this.state.modalCallback()}
        />
        <DocumentPageHeader
          contentsEditable={this.contentsEditable}
          document={this.state.document}
          errorMessage={overallErrorMessage}
          hasSaved={this.hasSaved}
          isSavingDocument={this.state.isSaving}
          onClone={this.requestCloneDocument}
          onSaveTitle={() => {}}
          onOpenShareModal={() => this.setOpenModal('share')}
          onSaveDocument={() => this.saveDocument()}
          title={this.state.document.title}
          titleEditable={false}
          hideAdminFeatures={true}
        />
        {this.state.isLoading ? <PageLoadingPlaceholder /> : this.renderMain()}
      </div>
    )
  }

  renderMain() {
    return (
      <div className="main-container">
        <Helmet>
          <title>{this.state.document.title}</title>
        </Helmet>
        <HotKeys
          keyMap={this.hotKeyMap}
          handlers={this.hotKeyHandlers}
          focused={true}
          attach={window}
        />
        {!this.contentsEditable && (
          <div className="banner dark-gray">
            <div className="container flex align-center justify-center">
              <MdLock className="locked-icon" />
              &nbsp;
              {this.state.document.contentsLocked
                ? 'This bin is locked, but you can clone it.'
                : 'This bin belongs to another user. Log in to make changes, or make a copy.'}
            </div>
          </div>
        )}
        <div className="main">
          {this.state.schema && (
            <div className="form-edit-namespace">
              <JsonSchemaForm
                schema={this.state.schema}
                formData={this.state.contents}
                onChange={data => console.log('changed', data)}
                onSubmit={() => console.log('submitted')}
                onError={() => console.log('errors')}
              />
            </div>
          )}
        </div>
      </div>
    )
  }
}

let mapStateToProps = state => {
  return {
    session: state.session,
    thinDocumentsCache: state.thinDocumentsCache,
  }
}

export default connect(mapStateToProps)(FormEditPage)
