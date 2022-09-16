const Component = () => {
    return (
        <div className="main__wrap">
            <main className="container">
                <div className="card__box">
                    <NavBar totalCounters={this.state.counters.filter(c => c.value > 0).length} />
                    <Counters
                        counters={this.state.counters}
                        onReset={this.handleReset}
                        onIncrement={this.handleIncrement}
                        onDecrement={this.handleDecrement}
                        onDelete={this.handleDelete}
                        onRestart={this.handleRestart}
                    />
                </div>
            </main>
        </div>
    )
}
