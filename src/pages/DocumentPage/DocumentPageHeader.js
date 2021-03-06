import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Tooltip from 'rc-tooltip'
import _ from 'lodash'

import Button from '../../components/Button'
import Document from '../../models/Document'
import Header from '../../components/Header'
import ClickToEdit from '../../components/ClickToEdit'

import {} from './DocumentPageHeader.css'

export default class DocumentPageHeader extends Component {
  static propTypes = {
    contentsEditable: PropTypes.bool,
    document: PropTypes.object.isRequired,
    errorMessage: PropTypes.string,
    hasSaved: PropTypes.bool.isRequired,
    isSavingDocument: PropTypes.bool,
    onClone: PropTypes.func.isRequired,
    onSaveTitle: PropTypes.func.isRequired,
    onOpenShareModal: PropTypes.func.isRequired,
    onSaveDocument: PropTypes.func.isRequired,
    title: PropTypes.string,
    titleEditable: PropTypes.bool,
  }

  state = {
    isSavingTitle: false,
  }

  saveNewTitle = newTitle => {
    this.setState({ isSavingTitle: true })

    return Document.update(this.props.document.token, {
      title: newTitle,
    }).then(({ data }) => {
      this.props.onSaveTitle(newTitle)
      this.setState({
        isSavingTitle: false,
      })
    })
  }

  render() {
    return (
      <Header className="document-page-header" fullWidth={true}>
        <ClickToEdit
          value={this.props.title || ''}
          readOnly={!this.props.titleEditable}
          onChange={this.saveNewTitle}
          isLoading={this.state.isSavingTitle}
          textClassName="page-title"
          inputClassName="edit-title-input"
        />
        {this.props.document.ownedByCurrentUser ? (
          <Tooltip
            placement="bottom"
            trigger={['click', 'hover']}
            overlay="Only you can edit this bin"
          >
            <div className="badge primary">Yours</div>
          </Tooltip>
        ) : (
          this.props.document.editable && (
            <Tooltip
              placement="bottom"
              trigger={['click', 'hover']}
              overlay="Anyone with the URL can edit this bin"
            >
              <div className="badge dark-gray">Public</div>
            </Tooltip>
          )
        )}
        <div className="flex-spring" />
        {this.props.contentsEditable && this.renderSaveButton()}
        <Button onClick={this.props.onClone}>Clone</Button>
        <Button className="subtle" onClick={this.props.onOpenShareModal}>
          Share
        </Button>
      </Header>
    )
  }

  renderSaveButton() {
    if (this.props.hasSaved) {
      return (
        <Button disabled className="cta disabled">
          Saved
        </Button>
      )
    } else if (!_.isEmpty(this.props.errorMessage)) {
      return (
        <Tooltip
          placement="bottom"
          trigger={['click', 'hover']}
          overlay={this.props.errorMessage}
        >
          <div className="button cta disabled">
            Can
            {"'"}t save
          </div>
        </Tooltip>
      )
    } else {
      return (
        <Button
          isLoading={this.props.isSavingDocument}
          className="cta"
          onClick={this.props.onSaveDocument}
        >
          Save
        </Button>
      )
    }
  }
}
