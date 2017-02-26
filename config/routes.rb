Rails.application.routes.draw do
  # TODO(azirbel): Copy opendoor/web setup, the routes are more beautiful
  devise_for :users, :controllers => {
    registrations: 'registrations',
    sessions: 'sessions'
  }

  devise_scope :user do
    get 'users/me' => 'sessions#info'
  end

  constraints :subdomain => 'api' do
    namespace :api, path: nil, defaults: { format: 'json' } do
      resources :documents, param: :token, path: '/', only: [:show]
    end
  end

  root 'app#index'
  get 'docs', to: 'app#index'
  get 'faq', to: 'app#index'
  get 'docs/:id', to: 'app#index'

  resources :documents,
    param: :token,
    only: [:index, :create, :show, :update, :destroy]

  get '/.well-known/acme-challenge/WMR9ZsaN_jU71mT7d4Z59RBrRZa4Nw80Ms61cfmhXWY' => 'pages#letsencrypt'
end
