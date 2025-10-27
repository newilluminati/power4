package main

import (
	"encoding/json"
	"html/template"
	"log"
	"net/http"
	"strconv"
	"sync"
)

type Game struct {
	sync.Mutex
	Board         [6][7]int
	CurrentPlayer int
	Winner        int
	Draw          bool
	WinCoords     [][2]int
}

func NewGame() *Game {
	g := &Game{CurrentPlayer: 1}
	return g
}

var game = NewGame()

func (g *Game) Reset() {
	g.Lock()
	defer g.Unlock()
	g.Board = [6][7]int{}
	g.CurrentPlayer = 1
	g.Winner = 0
	g.Draw = false
	g.WinCoords = nil
}

func (g *Game) Play(col int) {
	g.Lock()
	defer g.Unlock()
	if g.Winner != 0 || g.Draw {
		return
	}
	if col < 0 || col > 6 {
		return
	}
	for r := 5; r >= 0; r-- {
		if g.Board[r][col] == 0 {
			g.Board[r][col] = g.CurrentPlayer
			if coords := findWin(g.Board, r, col, g.CurrentPlayer); coords != nil {
				g.Winner = g.CurrentPlayer
				g.WinCoords = coords
			} else if isFull(g.Board) {
				g.Draw = true
			} else {
				if g.CurrentPlayer == 1 {
					g.CurrentPlayer = 2
				} else {
					g.CurrentPlayer = 1
				}
			}
			return
		}
	}
}

func isFull(b [6][7]int) bool {
	for r := 0; r < 6; r++ {
		for c := 0; c < 7; c++ {
			if b[r][c] == 0 {
				return false
			}
		}
	}
	return true
}

func findWin(b [6][7]int, row, col, player int) [][2]int {
	dirs := [][2]int{
		{0, 1},
		{1, 0},
		{1, 1},
		{1, -1},
	}
	for _, d := range dirs {
		var coords [][2]int
		coords = append(coords, [2]int{row, col})
		r := row + d[0]
		c := col + d[1]
		for r >= 0 && r < 6 && c >= 0 && c < 7 && b[r][c] == player {
			coords = append(coords, [2]int{r, c})
			r += d[0]
			c += d[1]
		}
		r = row - d[0]
		c = col - d[1]
		for r >= 0 && r < 6 && c >= 0 && c < 7 && b[r][c] == player {
			coords = append([][2]int{{r, c}}, coords...)
			r -= d[0]
			c -= d[1]
		}
		if len(coords) >= 4 {
			for i := 0; i+4 <= len(coords); i++ {
				block := coords[i : i+4]
				for _, p := range block {
					if p[0] == row && p[1] == col {
						return block
					}
				}
			}
			return coords[:4]
		}
	}
	return nil
}

type ApiState struct {
	Board         [][]int  `json:"board"`
	CurrentPlayer int      `json:"current_player"`
	Winner        int      `json:"winner"`
	Draw          bool     `json:"draw"`
	WinCoords     [][2]int `json:"win_coords"`
}

func (g *Game) ToApiState() ApiState {
	g.Lock()
	defer g.Unlock()
	board := make([][]int, 6)
	for r := 0; r < 6; r++ {
		board[r] = make([]int, 7)
		for c := 0; c < 7; c++ {
			board[r][c] = g.Board[r][c]
		}
	}
	return ApiState{
		Board:         board,
		CurrentPlayer: g.CurrentPlayer,
		Winner:        g.Winner,
		Draw:          g.Draw,
		WinCoords:     g.WinCoords,
	}
}

var tpl *template.Template

func init() {
	tpl = template.Must(template.ParseFiles("templates/index.html"))
}

func indexHandler(w http.ResponseWriter, r *http.Request) {
	if err := tpl.Execute(w, nil); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func apiStateHandler(w http.ResponseWriter, r *http.Request) {
	state := game.ToApiState()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state)
}

func apiPlayHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	colStr := r.FormValue("col")
	if colStr == "" {
		var body struct {
			Col int `json:"col"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err == nil {
			game.Play(body.Col)
			state := game.ToApiState()
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(state)
			return
		}
		http.Error(w, "Missing col", http.StatusBadRequest)
		return
	}
	col, err := strconv.Atoi(colStr)
	if err != nil {
		http.Error(w, "bad col", http.StatusBadRequest)
		return
	}
	game.Play(col)
	state := game.ToApiState()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state)
}

func apiResetHandler(w http.ResponseWriter, r *http.Request) {
	game.Reset()
	state := game.ToApiState()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(state)
}

func main() {
	fs := http.FileServer(http.Dir("static"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.HandleFunc("/", indexHandler)
	http.HandleFunc("/api/state", apiStateHandler)
	http.HandleFunc("/api/play", apiPlayHandler)
	http.HandleFunc("/api/reset", apiResetHandler)

	log.Println("Serveur démarré sur http://localhost:8080")
	if err := http.ListenAndServe(":8080", nil); err != nil {
		log.Fatal(err)
	}
}
