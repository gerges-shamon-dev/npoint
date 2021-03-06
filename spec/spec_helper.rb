ENV['RAILS_ENV'] ||= 'test'
require File.expand_path('../../config/environment', __FILE__)

# Prevent database truncation if the environment is production
abort("Rails is running in production mode!") if Rails.env.production?

require 'rspec/rails' # Must go before other requires
require 'devise'
require 'capybara/rails'
require 'capybara/rspec'
require 'selenium/webdriver'

# https://robots.thoughtbot.com/headless-feature-specs-with-chrome
Capybara.register_driver :chrome do |app|
  Capybara::Selenium::Driver.new(app, browser: :chrome)
end

Capybara.register_driver :headless_chrome do |app|
  capabilities = Selenium::WebDriver::Remote::Capabilities.chrome(
    chromeOptions: { args: %w(headless disable-gpu) }
  )

  Capybara::Selenium::Driver.new app,
    browser: :chrome,
    desired_capabilities: capabilities
end

Capybara.javascript_driver = :headless_chrome

# May be useful for testing against a locally running webpack build
# https://stackoverflow.com/questions/8662554/how-to-use-the-test-database-with-capybara
#Capybara.run_server = true
#Capybara.server_port = 7000
#Capybara.app_host = "http://localhost:#{Capybara.server_port}"

# Load all files in support/. Note: don't give these files names ending
# in _spec, or else they will also be run as specs.
Dir[Rails.root.join('spec/support/**/*.rb')].each { |f| require f }

# Check for pending migration and apply them before tests are run
ActiveRecord::Migration.maintain_test_schema!

RSpec.configure do |config|
  config.expect_with :rspec do |expectations|
    # Will default to `true` in RSpec 4
    expectations.include_chain_clauses_in_custom_matcher_descriptions = true
  end

  config.mock_with :rspec do |mocks|
    # Prevent mocking or stubbing a method that does not exist on a real object
    mocks.verify_partial_doubles = true
  end

  # Will default to `:apply_to_host_groups` in RSpec 4
  config.shared_context_metadata_behavior = :apply_to_host_groups

  # Disable `should` matchers, use `expect` all the time instead
  config.disable_monkey_patching!

  # Print the 10 slowest examples and groups at the end of a spec run
  # config.profile_examples = 10

  # Run specs in random order, allow setting --seed CLI option
  config.order = :random
  Kernel.srand config.seed

  config.use_transactional_fixtures = true

  # Infer things like `type: :controller`
  config.infer_spec_type_from_file_location!

  # Filter lines from Rails gems in backtraces.
  config.filter_rails_from_backtrace!

  config.include FactoryBot::Syntax::Methods
  config.include Devise::Test::ControllerHelpers, :type => :controller
  config.include ControllerSpecHelper, :type => :controller
end
